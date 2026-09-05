"""Project Constitution §7 into the current outline without publishing chapter prose."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re

from author_prologue import build_author_prologue

ROOT = Path(__file__).resolve().parents[1]
CONSTITUTION = Path("CONSTITUTION.md")
SOURCE = Path("manuscript/2026-09-05-rebuild/contents-v5.1.md")
ARCHIVE = Path("src/data/previous-edition.json")
MANIFEST = Path("manuscript/2026-09-05-rebuild/contents-v5.1-manifest.json")
DOWNLOAD = Path("public/book/contents-v5.1.md")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def source_projection() -> bytes:
    text = (ROOT / CONSTITUTION).read_text("utf-8-sig").replace("\r\n", "\n")
    section = text.split("## 7. Архитектура книги\n", 1)[1].split("\n## 8.", 1)[0].strip()
    paragraphs = []
    for chunk in re.split(r"\n\s*\n", section):
        if chunk.startswith("### Часть "):
            paragraphs.append(chunk.replace("### ", "## ", 1))
        elif match := re.fullmatch(r"\*\*((?:Пролог|Эпилог|\d+)\. .+?)\*\* (.+)", chunk):
            level = "###" if match[1][0].isdigit() else "##"
            paragraphs.extend([level + " " + match[1], match[2]])
        else:
            paragraphs.append(chunk)
    return ("# Право на решение\n\nКак остаться авторами будущего рядом с более сильным интеллектом\n\n"
            + "\n\n".join(paragraphs) + "\n").encode("utf-8")


def build():
    raw = source_projection()
    if (ROOT / SOURCE).exists() and (ROOT / SOURCE).read_bytes() != raw:
        raise ValueError("contents-v5.1.md differs from Constitution §7; update the explicit projection")
    chunks = re.split(r"\n\s*\n", raw.decode("utf-8").strip())
    parts, definitions, blocks = [], [], []
    prologue, epilogue, current = None, None, None
    source = {"path": SOURCE.as_posix(), "sha256": sha(raw)}
    for index, chunk in enumerate(chunks[2:], 1):
        heading = re.fullmatch(r"(#{2,3}) (.+)", chunk)
        text = heading[2] if heading else chunk
        block = {"type": "heading" if heading else "paragraph", "id": f"contents-v5-p{index:03d}", "text": text}
        if heading:
            block["level"] = len(heading[1])
        blocks.append(block)
        if not heading:
            if current is not None:
                current["summary"].append(text)
                # The closing architecture policy belongs to the outline, not the epilogue summary.
                current = None
            continue
        if text.startswith("Часть "):
            match = re.fullmatch(r"Часть ([IVX]+)\. (.+)", text)
            assert match
            parts.append({"id": "part-" + match[1].lower(), "number": match[1], "title": text, "description": []})
            current = None
        elif text.startswith("Пролог."):
            prologue = current = {"title": text.removesuffix("."), "summary": []}
        elif text.startswith("Эпилог."):
            epilogue = current = {"title": text.removesuffix("."), "summary": []}
        else:
            match = re.fullmatch(r"(\d+)\. (.+)", text)
            assert match and parts
            current = {"id": f"chapter-{int(match[1]):02d}", "number": int(match[1]),
                       "title": f"Глава {match[1]}. {match[2].removesuffix('.')}",
                       "part": parts[-1]["title"], "summary": []}
            definitions.append(current)
    assert [part["number"] for part in parts] == ["I", "II", "III", "IV", "V", "VI"]
    assert [chapter["number"] for chapter in definitions] == list(range(1, 19))
    assert all(len([c for c in definitions if c["part"] == p["title"]]) == 3 for p in parts)
    assert prologue and epilogue and all(c["summary"] for c in [prologue, epilogue, *definitions])

    def entry(identifier, title, kind, *, number=None, part=None, body=None, summary=None):
        available = body is not None
        result = {"id": identifier, "number": number, "title": title, "part": part, "kind": kind,
                  "status": "available" if available else "planned",
                  "publicationStatus": "published" if available else "draft", "blocks": body or [],
                  "version": "5.1", "contentKind": "outline", "source": source,
                  "editorialStatus": "constitution-outline" if available else "planned-chapter"}
        if summary:
            result["summary"] = "\n\n".join(summary)
        return result

    current_prologue = {**build_author_prologue(), "outlineTitle": prologue["title"],
                        "summary": "\n\n".join(prologue["summary"])}
    chapters = [current_prologue,
                entry("contents", "Развёрнутое содержание", "frontmatter", body=blocks),
                *[entry(c["id"], c["title"], "chapter", number=c["number"], part=c["part"], summary=c["summary"])
                  for c in definitions],
                entry("epilogue", epilogue["title"], "backmatter", summary=epilogue["summary"])]
    text = "\n\n".join(b["text"] for c in chapters for b in c["blocks"])
    book = {"schemaVersion": 2, "contentKind": "outline", "version": "5.1", "title": chunks[0][2:],
            "subtitle": chunks[1], "edition": "2026-09-06", "releaseId": "constitution-contents-v5.1-2026-09-06",
            "publicationStatus": "published",
            "source": {"filename": SOURCE.name, "format": "constitution_outline", "sha256": sha(raw),
                       "importer": "scripts/constitution_contents.py",
                       "textPolicy": "Точная архитектурная проекция §7 Конституции 1.1. Сохранены опубликованные тексты; новая редакционная приёмка не заявляется."},
            "parts": parts, "chapters": chapters, "notes": [],
            "statistics": {"sections": len(chapters), "chapters": 18, "parts": 6, "availableChapters": 0,
                           "plannedChapters": 18, "blocks": sum(len(c["blocks"]) for c in chapters), "notes": 0,
                           "words": len(re.findall(r"\S+", text)), "characters": len(text)}}
    manifest = {"releaseId": book["releaseId"], "version": "5.1", "edition": book["edition"],
                "constitution": {"path": CONSTITUTION.as_posix(), "sha256": sha((ROOT / CONSTITUTION).read_bytes()), "section": "7"},
                "authorSource": source,
                "sourceSelection": "По поручению автора от 06.09.2026 правила пересобраны по Конституции 1.1; оглавления v4.0 и v5.0 сохранены как история. Согласие всех соавторов не заявляется.",
                "normalization": "Раздел 7 целиком; жирные заголовки вынесены в Markdown-заголовки, описания сохранены в том же порядке. Названия в навигации без конечной точки.",
                "bookSha256": sha(encoded(book)),
                "archive": {"path": ARCHIVE.as_posix(), "sha256": sha((ROOT / ARCHIVE).read_bytes())},
                "importerSha256": sha(Path(__file__).read_bytes()),
                "checks": {"parts": 6, "numberedChapters": 18, "plannedChapters": 18, "prologue": True,
                           "separateEpilogue": True, "allAuthorParagraphsPreserved": True},
                "prologue": current_prologue["source"],
                "scope": "Архитектура книги. Написание и повторная приёмка пролога, глав и эпилога не выполнялись; доступность прозы задаётся отдельным литературным выпуском."}
    return {Path("src/data/book.json"): encoded(book), SOURCE: raw, DOWNLOAD: raw, MANIFEST: encoded(manifest)}
