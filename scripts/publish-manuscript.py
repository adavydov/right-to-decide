"""Assemble explicitly selected literary chapters over the preserved author outline.

Publish reviewed sources: python scripts/publish-manuscript.py --chapters 1-3,5
Verify the current release: python scripts/publish-manuscript.py --check
Sources outside the explicit selection are never included in the reader.
"""
from __future__ import annotations

import argparse
import copy
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CHAPTER_DIRECTORY = Path("manuscript/2026-09-05-rebuild/chapters-v4")
RELEASE_MANIFEST = CHAPTER_DIRECTORY / "release-manifest.json"
BOOK = Path("src/data/book.json")
spec = importlib.util.spec_from_file_location("author_contents", ROOT / "scripts/constitution_contents.py")
assert spec and spec.loader
outline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(outline)


def chapter_selection(value: str) -> list[int]:
    numbers = []
    for item in value.split(","):
        match = re.fullmatch(r"\s*(\d+)(?:-(\d+))?\s*", item)
        if not match:
            raise ValueError("Use chapter numbers or ranges, for example 1-3,5")
        start, end = int(match[1]), int(match[2] or match[1])
        if not 1 <= start <= end <= 18:
            raise ValueError("Chapter numbers must be increasing ranges within 1-18")
        numbers.extend(range(start, end + 1))
    if len(set(numbers)) != len(numbers):
        raise ValueError("A chapter was selected more than once")
    return sorted(numbers)


def parse_chapter(raw: bytes, chapter: dict) -> dict:
    """Keep prose and paragraph order; interpret only the declared heading syntax."""
    text = raw.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n").strip()
    chunks = [chunk.strip() for chunk in re.split(r"\n\s*\n", text)]
    expected_title = re.sub(r"^Глава \d+\.\s*", "", chapter["title"]).rstrip(".")
    heading = re.fullmatch(r"# (?:Глава (\d+)\. )?([^\n]+)", chunks[0])
    if not heading or heading[2].rstrip(".") != expected_title:
        raise ValueError(f"{chapter['id']}: source title must match the current author outline")
    if heading[1] and int(heading[1]) != chapter["number"]:
        raise ValueError(f"{chapter['id']}: source chapter number differs")
    if len(chunks) < 2:
        raise ValueError(f"{chapter['id']}: an available chapter must contain prose")
    blocks = []
    for index, chunk in enumerate(chunks[1:], 1):
        subheading = re.fullmatch(r"(#{2,3}) ([^\n]+)", chunk)
        if not subheading and re.search(r"(?m)^(?:#{1,6} |```|~~~|[-*+] |\d+\. |!\[|\[\^|> )", chunk):
            raise ValueError(f"{chapter['id']}: unsupported Markdown in block {index}; use prose and ##/### headings")
        if re.search(r"!?\[[^\]]*\]\(|\[\^[^\]]+\]", chunk):
            raise ValueError(f"{chapter['id']}: inline links/notes need an explicit renderer before release")
        block = {"type": "heading" if subheading else "paragraph",
                 "id": f"literary-v4-{chapter['id']}-p{index:03d}",
                 "text": subheading[2] if subheading else chunk}
        if subheading:
            block["level"] = len(subheading[1])
        blocks.append(block)
    if not any(block["type"] == "paragraph" and block["text"] != "⸻" for block in blocks):
        raise ValueError(f"{chapter['id']}: headings and separators alone are not a chapter")
    relative = CHAPTER_DIRECTORY / f"{chapter['id']}.md"
    return {**chapter, "status": "available", "publicationStatus": "published",
            "contentKind": "manuscript", "version": "1.0", "editorialStatus": "literary-release",
            "source": {"path": relative.as_posix(), "sha256": outline.sha(raw)}, "blocks": blocks}


def assemble(base_book: dict, numbers: list[int], source_bytes: dict[int, bytes]) -> tuple[dict, list[dict]]:
    """Build in memory so release checks never mutate the manuscript or its history."""
    if not numbers or numbers != sorted(set(numbers)) or any(number not in range(1, 19) for number in numbers):
        raise ValueError("Select at least one unique chapter number within 1-18")
    book = copy.deepcopy(base_book)
    for index, chapter in enumerate(book["chapters"]):
        if chapter["kind"] == "chapter" and chapter["number"] in numbers:
            book["chapters"][index] = parse_chapter(source_bytes[chapter["number"]], chapter)
    released = [chapter for chapter in book["chapters"] if chapter["kind"] == "chapter" and chapter["status"] == "available"]
    sources = [{"id": chapter["id"], "number": chapter["number"], **chapter["source"]} for chapter in released]
    identity = {"contents": book["source"]["sha256"], "prologue": book["chapters"][0]["source"], "chapters": sources}
    source_hash = outline.sha(outline.encoded(identity))
    book["contentKind"] = "manuscript"
    book["releaseId"] = f"literary-manuscript-v5.0-{source_hash[:12]}"
    book["source"] = {"filename": RELEASE_MANIFEST.name, "format": "markdown-manuscript",
                      "sha256": source_hash, "importer": "scripts/publish-manuscript.py",
                      "textPolicy": "Содержание следует §7 Конституции 1.0. Тексты ранее опубликованных пролога и глав сохранены. Их соответствие новой конституционной приёмке не заявляется; эпилог остаётся в плане."}
    blocks = [block for chapter in book["chapters"] for block in chapter["blocks"]]
    text = "\n\n".join(block["text"] for block in blocks)
    book["statistics"] = {"sections": len(book["chapters"]), "chapters": 18, "parts": 6,
                          "availableChapters": len(released), "plannedChapters": 18 - len(released),
                          "blocks": len(blocks), "notes": 0, "words": len(re.findall(r"\S+", text)),
                          "characters": len(text)}
    return book, sources


def build(numbers: list[int]) -> dict[Path, bytes]:
    foundation = outline.build()
    # Current outline artifacts must match the Constitution; v4 artifacts remain historical.
    for path, expected in foundation.items():
        if path != BOOK and (ROOT / path).exists() and (ROOT / path).read_bytes() != expected:
            raise ValueError("Constitution outline artifact differs: " + path.as_posix())
    base_book = json.loads(foundation[BOOK])
    source_bytes = {number: (ROOT / CHAPTER_DIRECTORY / f"chapter-{number:02d}.md").read_bytes() for number in numbers}
    book, sources = assemble(base_book, numbers, source_bytes)
    manifest = {"schemaVersion": 1, "releaseId": book["releaseId"], "architectureVersion": "5.0",
                "chapterNumbers": numbers, "chapters": sources,
                "authorContents": base_book["chapters"][1]["source"], "prologue": base_book["chapters"][0]["source"],
                "archive": {"path": outline.ARCHIVE.as_posix(), "sha256": outline.sha((ROOT / outline.ARCHIVE).read_bytes())},
                "bookSha256": outline.sha(outline.encoded(book)), "importerSha256": outline.sha(Path(__file__).read_bytes()),
                "sourceHashPolicy": "book.source.sha256 hashes the preserved contents/prologue sources and the ordered selected chapter sources",
                "constitution": {"path": "CONSTITUTION.md", "sha256": outline.sha((ROOT / "CONSTITUTION.md").read_bytes())},
                "acceptanceStatus": "published-texts-pending-constitution-review",
                "scope": "Переход оглавления на Конституцию 1.0 при сохранении текстов и статусов уже опубликованных глав. Повторная приёмка корпуса по новой Конституции не выполнялась."}
    return {**{path: raw for path, raw in foundation.items() if path != BOOK},
            BOOK: outline.encoded(book), RELEASE_MANIFEST: outline.encoded(manifest)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--chapters", help="Explicit complete release selection, for example 1-3,5 or 1-18")
    args = parser.parse_args()
    if args.check and args.chapters:
        parser.error("--check reads the saved release selection; do not combine it with --chapters")
    try:
        if args.check and not (ROOT / RELEASE_MANIFEST).exists():
            outputs = outline.build()
        else:
            if args.check:
                selection = json.loads((ROOT / RELEASE_MANIFEST).read_text("utf-8"))["chapterNumbers"]
            elif args.chapters:
                selection = chapter_selection(args.chapters)
                if (ROOT / RELEASE_MANIFEST).exists():
                    previous = json.loads((ROOT / RELEASE_MANIFEST).read_text("utf-8"))["chapterNumbers"]
                    if not set(previous).issubset(selection):
                        raise ValueError("The new selection omits an already released chapter; keep the full release selection")
            else:
                parser.error("Specify the reviewed chapters with --chapters before assembling a release")
            outputs = build(selection)
        for relative, raw in outputs.items():
            target = ROOT / relative
            if args.check:
                if target.read_bytes() != raw:
                    raise ValueError("Generated release differs: " + relative.as_posix())
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(raw)
        print("MANUSCRIPT SOURCE CHECK OK" if args.check else "MANUSCRIPT BUILT: " + ", ".join(str(n) for n in selection))
    except (ValueError, OSError, KeyError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
