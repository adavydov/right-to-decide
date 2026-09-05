"""Publish the author's approved contents, preserving the previous reader edition."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
from author_prologue import build_author_prologue

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("manuscript/2026-09-05-rebuild/contents-v4.0.md")
ARCHIVE = Path("src/data/previous-edition.json")
MANIFEST = Path("manuscript/2026-09-05-rebuild/contents-v4.0-manifest.json")
DOWNLOAD = Path("public/book/contents-v4.0.md")

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

def build():
    raw = (ROOT / SOURCE).read_bytes()
    chunks = re.split(r"\n\s*\n", raw.decode("utf-8-sig").strip())
    assert chunks[0] == "# Право на решение", "Unexpected author title"
    subtitle = chunks[1]
    assert subtitle == "Как остаться авторами будущего рядом с более сильным интеллектом"
    parts, definitions, blocks = [], [], []
    prologue = None
    for index, chunk in enumerate(chunks[2:], 1):
        heading = re.fullmatch(r"(#{2,3}) (.+)", chunk)
        text = heading[2] if heading else chunk
        block = {"type": "heading" if heading else "paragraph",
                 "id": f"contents-v4-p{index:03d}", "text": text}
        if heading:
            block["level"] = len(heading[1])
        blocks.append(block)
        if heading and heading[2].startswith("Пролог."):
            assert prologue is None and not parts
            prologue = {"id": "prologue", "title": heading[2], "summary": []}
        elif heading and heading[2].startswith("Часть "):
            match = re.fullmatch(r"Часть ([IVX]+)\. (.+)", heading[2])
            assert match, "Unrecognized part heading"
            parts.append({"id": "part-" + match[1].lower(), "number": match[1],
                          "title": heading[2], "description": []})
        elif heading:
            match = re.fullmatch(r"(\d+)\. (.+)", heading[2])
            assert match and parts, "Unrecognized chapter heading"
            definitions.append({"id": f"chapter-{int(match[1]):02d}", "number": int(match[1]),
                                "title": f"Глава {match[1]}. {match[2].removesuffix('.')}",
                                "part": parts[-1]["title"]})
        else:
            assert prologue, "Description before prologue"
            (parts[-1]["description"] if parts else prologue["summary"]).append(text)
    assert [p["number"] for p in parts] == ["I", "II", "III", "IV", "V", "VI"]
    assert [c["number"] for c in definitions] == list(range(1, 19))
    assert all(len([c for c in definitions if c["part"] == p["title"]]) == 3 for p in parts)
    assert all(p["description"] for p in parts)
    assert prologue and prologue["summary"]
    source = {"path": SOURCE.as_posix(), "sha256": sha(raw)}
    def entry(identifier, title, kind, *, number=None, part=None, available=False, body=None, summary=None):
        chapter = {"id": identifier, "number": number, "title": title, "part": part,
                   "kind": kind, "status": "available" if available else "planned",
                   "publicationStatus": "published" if available else "draft",
                   "blocks": body or [], "version": "4.0", "contentKind": "outline",
                   "editorialStatus": "author-approved-contents" if available else "planned-chapter",
                   "source": source}
        if summary:
            chapter["summary"] = summary
        return chapter
    current_prologue = build_author_prologue()
    assert current_prologue["id"] == "prologue" and current_prologue["status"] == "available"
    prologue_source = current_prologue["source"]
    assert sha((ROOT / prologue_source["path"]).read_bytes()) == prologue_source["sha256"]
    current_prologue = {**current_prologue, "outlineTitle": prologue["title"],
                        "contentKind": "manuscript", "summary": "\n\n".join(prologue["summary"])}
    chapters = [
        current_prologue,
        entry("contents", "Развёрнутое содержание", "frontmatter", available=True, body=blocks),
        *[entry(c["id"], c["title"], "chapter", number=c["number"], part=c["part"]) for c in definitions],
    ]
    text = "\n\n".join(b["text"] for b in blocks)
    book = {
        "schemaVersion": 2, "contentKind": "outline", "version": "4.0",
        "title": "Право на решение", "subtitle": subtitle, "edition": "2026-09-05",
        "releaseId": "author-contents-v4.0-2026-09-05", "publicationStatus": "published",
        "source": {"filename": SOURCE.name, "format": "author_outline", "sha256": sha(raw),
                   "importer": "scripts/publish-author-contents.py",
                   "textPolicy": "Последнее авторское содержание от 05.09.2026. Сохранены все заголовки и абзацы; главы отмечены как планируемые. Прежняя рукопись доступна отдельно в архиве."},
        "parts": parts, "chapters": chapters, "notes": [],
        "statistics": {"sections": len(chapters), "chapters": 18, "parts": 6,
                       "availableChapters": 0, "plannedChapters": 18,
                       "blocks": len(blocks) + len(current_prologue["blocks"]), "notes": 0,
                       "words": len(re.findall(r"\S+", text + "\n" + "\n".join(b["text"] for b in current_prologue["blocks"]))), "characters": len(text) + sum(len(b["text"]) for b in current_prologue["blocks"])},
    }
    # Every visible author paragraph/heading must survive the projection in source order.
    expected = "\n\n".join(re.sub(r"^#{2,3} ", "", chunk) for chunk in chunks[2:])
    assert text == expected
    archive_raw = (ROOT / ARCHIVE).read_bytes()
    archive = json.loads(archive_raw)
    assert archive["schemaVersion"] == 1 and archive["source"]["format"] == "docx"
    assert len([c for c in archive["chapters"] if c["kind"] == "chapter"]) == 18
    manifest = {
        "releaseId": book["releaseId"], "version": "4.0", "edition": book["edition"],
        "authorSource": source,
        "sourceSelection": "Последнее уточнение автора: шесть частей, восемнадцать глав и пролог; заменяет предшествующее поручение о пяти частях.",
        "normalization": "Добавлена Markdown-разметка, сохранены текст и порядок всех пунктов; в отдельных названиях глав снята завершающая точка списка.",
        "bookSha256": sha(encoded(book)), "archive": {"path": ARCHIVE.as_posix(), "sha256": sha(archive_raw)},
        "importerSha256": sha(Path(__file__).read_bytes()),
        "checks": {"parts": 6, "numberedChapters": 18, "plannedChapters": 18,
                   "prologue": True, "separateEpilogue": False, "allAuthorParagraphsPreserved": True},
        "prologue": prologue_source,
        "scope": "Сохранён новый опубликованный авторский пролог. Публикация содержания; написание и научная приёмка новых глав не выполнялись.",
    }
    return {Path("src/data/book.json"): encoded(book), DOWNLOAD: raw, MANIFEST: encoded(manifest)}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = build()
    for relative, raw in outputs.items():
        target = ROOT / relative
        if args.check:
            assert target.read_bytes() == raw, "Generated output differs: " + relative.as_posix()
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
    print("CONTENTS V4 CHECK OK" if args.check else "CONTENTS V4 BUILT")
    print("6 parts; 18 planned chapters; prologue; all author text preserved; previous edition archived.")

if __name__ == "__main__":
    main()
