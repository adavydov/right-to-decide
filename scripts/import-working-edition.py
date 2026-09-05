#!/usr/bin/env python3
"""Freeze explicit Markdown selections and produce reproducible BookJSON v2.
Standard library only. Never writes src/data/book.json.
"""
from __future__ import annotations
import argparse
from datetime import date
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tempfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
NOTE = re.compile(r"^\[\^?(\d+)\]:\s*(.*)$")
HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
LIST = re.compile(r"^(\s*)([-+*]|\d+[.)])\s+(.+)$")

def fail(message):
    raise ValueError(message)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")

def source_path(root, relative):
    if not isinstance(relative, str) or "\\" in relative:
        fail("Input path must be a repository-relative POSIX path")
    path = PurePosixPath(relative)
    if path.is_absolute() or ".." in path.parts or not path.parts or ":" in relative:
        fail("Unsafe input path: " + relative)
    resolved = (root / relative).resolve(strict=True)
    if not resolved.is_relative_to(root.resolve()) or resolved.suffix.lower() != ".md":
        fail("Input must be Markdown inside the source root: " + relative)
    return resolved

def entries(manifest):
    result = [("contents", manifest["contents"])]
    if manifest.get("preface"):
        result.append(("preface", manifest["preface"]))
    result.extend((f"chapter-{entry['number']:02d}", entry) for entry in manifest.get("chapters", []))
    return result

def validate_manifest(manifest):
    if manifest.get("schemaVersion") != 1:
        fail("Manifest schemaVersion must be 1")
    date.fromisoformat(manifest["edition"])
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*", manifest.get("releaseId", "")):
        fail("releaseId must be a stable lowercase identifier")
    for field in ("title", "subtitle"):
        if not isinstance(manifest.get(field), str) or not manifest[field].strip():
            fail("Missing " + field)
    if manifest.get("publicationStatus", "draft") != "draft":
        fail("Only working draft releases are supported")
    numbers = [entry["number"] for entry in manifest.get("chapters", [])]
    if any(type(n) is not int or not 1 <= n <= 18 for n in numbers) or len(numbers) != len(set(numbers)):
        fail("Chapter numbers must be unique integers 1..18")
    paths = []
    for key, entry in entries(manifest):
        if not re.fullmatch(r"[0-9a-fA-F]{64}", entry.get("sha256", "")):
            fail("Explicit SHA-256 required for " + key)
        if not entry.get("version"):
            fail("Explicit version required for " + key)
        paths.append(entry["path"])
    if len(paths) != len(set(paths)):
        fail("Selected sources must have distinct paths")

def stable_read(root, entry):
    path = source_path(root, entry["path"])
    first_stat = path.stat()
    first = path.read_bytes()
    second = path.read_bytes()
    final_stat = path.stat()
    if first != second or (first_stat.st_size, first_stat.st_mtime_ns) != (final_stat.st_size, final_stat.st_mtime_ns):
        fail("Source changed while reading: " + entry["path"])
    if sha(first) != entry["sha256"].lower():
        fail("Source SHA-256 differs from manifest: " + entry["path"])
    first.decode("utf-8-sig")
    return first

def balanced(text, start, opening, closing):
    depth, index = 1, start + 1
    while index < len(text):
        if text[index] == "\\":
            index += 2
            continue
        if text[index] == opening:
            depth += 1
        elif text[index] == closing:
            depth -= 1
            if depth == 0:
                return index
        index += 1
    fail("Unclosed Markdown delimiter: " + text[start:start + 100])

def safe_href(href):
    href = href.strip()
    if href.startswith("<") and href.endswith(">"):
        href = href[1:-1]
    if any(ord(c) < 32 for c in href) or "\\" in href or re.search(r"\s", href):
        fail("Unsupported link destination: " + href)
    parsed = urlsplit(href)
    if parsed.scheme not in {"http", "https", "mailto"} or (parsed.scheme in {"http", "https"} and not parsed.netloc):
        fail("Link must explicitly target HTTP(S) or mailto: " + href)
    return href

def inline(text, chapter_id, references, marks=None):
    """Flatten supported inline Markdown to safe text runs with boolean marks."""
    marks, runs = marks or {}, []
    def emit(value, extra=None):
        if value:
            run = {"text": value, **marks, **(extra or {})}
            if runs and {k: v for k, v in runs[-1].items() if k != "text"} == {k: v for k, v in run.items() if k != "text"}:
                runs[-1]["text"] += value
            else:
                runs.append(run)
    index = 0
    while index < len(text):
        char = text[index]
        if char == "\\" and index + 1 < len(text) and text[index + 1] in r"\`*_{}[]()#+-.!>|":
            emit(text[index + 1]); index += 2; continue
        if text.startswith("![", index):
            fail("Image requires explicit asset handling")
        if char == "[":
            end = balanced(text, index, "[", "]")
            label = text[index + 1:end]
            if end + 1 < len(text) and text[end + 1] == "(":
                stop = balanced(text, end + 1, "(", ")")
                href = safe_href(text[end + 2:stop])
                if "href" in marks:
                    fail("Nested links are unsupported")
                runs.extend(inline(label, chapter_id, references, {**marks, "href": href}))
                index = stop + 1; continue
            if re.fullmatch(r"\^?\d+", label):
                number = int(label.lstrip("^"))
                references.append(number)
                emit(f"[{number}]", {"noteId": f"{chapter_id}-note-{number}"})
                index = end + 1; continue
            emit(text[index:end + 1]); index = end + 1; continue
        delimiter = next((d for d in ("**", "__", "*", "_", "`") if text.startswith(d, index)), None)
        if delimiter:
            if delimiter == "_" and index and text[index - 1].isalnum():
                emit(char); index += 1; continue
            end = text.find(delimiter, index + len(delimiter))
            if end < 0:
                emit(delimiter); index += len(delimiter); continue
            content = text[index + len(delimiter):end]
            flag = "code" if delimiter == "`" else "strong" if len(delimiter) == 2 else "emphasis"
            if flag == "code":
                emit(content, {flag: True})
            else:
                runs.extend(inline(content, chapter_id, references, {**marks, flag: True}))
            index = end + len(delimiter); continue
        emit(char)
        index += 1
    return runs

def normalized(text):
    return re.sub(r"\s+", " ", text).strip()

def reference_plain(text):
    """Separate visible-text normalization used to verify the rendered runs."""
    # Actual manuscript links have plain or emphasized labels, balanced URL
    # parentheses, and no reference-style nonnumeric definitions.
    result, index = [], 0
    while index < len(text):
        if text[index] == "[":
            end = balanced(text, index, "[", "]")
            if end + 1 < len(text) and text[end + 1] == "(":
                stop = balanced(text, end + 1, "(", ")")
                result.append(reference_plain(text[index + 1:end]))
                index = stop + 1
                continue
        if text[index] == "\\" and index + 1 < len(text) and text[index + 1] in r"\`*_{}[]()#+-.!>|":
            result.append(text[index + 1]); index += 2; continue
        result.append(text[index]); index += 1
    value = "".join(result)
    value = re.sub(r"\[\^(\d+)\]", r"[\1]", value)
    for pattern in (r"\*\*(.+?)\*\*", r"__(.+?)__", r"(?<!\w)\*(.+?)\*", r"(?<!\w)_(.+?)_", r"`([^`]+)`"):
        value = re.sub(pattern, r"\1", value, flags=re.S)
    return value

def parse_document(raw, chapter_id, expected_title):
    lines = raw.decode("utf-8-sig").splitlines()
    nonempty = {index + 1 for index, line in enumerate(lines) if line.strip()}
    consumed, blocks, notes, references, source_segments = [], [], [], [], []
    current_note, title, note_heading, index = None, None, None, 0
    def add(text, start, end, *, heading=None, quote=False, listing=None):
        target = current_note["blocks"] if current_note else blocks
        runs = inline(text, chapter_id, references)
        visible = "".join(run["text"] for run in runs)
        if normalized(reference_plain(text)) != normalized(visible):
            fail(f"{chapter_id}:{start}: Markdown visible-text round trip failed")
        block = {"type": "heading" if heading else "paragraph", "id": f"{chapter_id}-p{start:04d}",
                 "text": visible, "runs": runs, "sourceLines": [start, end]}
        if heading: block["level"] = heading
        if quote: block["role"] = "quote"
        if listing: block["list"] = listing
        target.append(block)
        source_segments.append(reference_plain(text))
    while index < len(lines):
        if not lines[index].strip():
            index += 1; continue
        start, line = index + 1, lines[index].strip()
        if title is None:
            if not line.startswith("# "): fail(chapter_id + ": source must start with H1")
            title = line[2:].strip()
            if title != expected_title:
                fail(f"{chapter_id}: title differs from contents: {title!r} != {expected_title!r}")
            consumed.append(start); index += 1; continue
        note_match, heading_match = NOTE.match(line), HEADING.match(line)
        if note_match:
            number = int(note_match[1])
            if number <= 0 or any(note["number"] == number for note in notes):
                fail(chapter_id + ": repeated/invalid note number")
            current_note = {"id": f"{chapter_id}-note-{number}", "kind": "endnote", "chapterId": chapter_id,
                            "number": number, "sourceId": f"{chapter_id}-p{start:04d}",
                            "blocks": [], "sourceLines": [start, start]}
            notes.append(current_note)
            consumed.append(start)
            note_lines = [note_match[2]] if note_match[2] else []
            index += 1
            while index < len(lines) and lines[index].strip():
                continuation = lines[index].strip()
                if HEADING.match(continuation) or NOTE.match(continuation) or LIST.match(lines[index]) or continuation.startswith((">", "|", "```", "~~~", "![")):
                    break
                note_lines.append(continuation)
                consumed.append(index + 1)
                index += 1
            if note_lines: add("\n".join(note_lines), start, index)
            current_note["sourceLines"][1] = index
            continue
        if heading_match:
            level, heading_text = len(heading_match[1]), heading_match[2]
            if re.fullmatch(r"Примечани[ея](?:\s+.*)?", heading_text, re.I):
                if current_note or note_heading: fail(chapter_id + ": misplaced note heading")
                note_heading = heading_text
                consumed.append(start); index += 1; continue
            if current_note: fail(chapter_id + ": body heading after endnotes is ambiguous")
            add(heading_text, start, start, heading=level)
            consumed.append(start); index += 1; continue
        if line.startswith(("```", "~~~", "|", "![")) or re.fullmatch(r"[-*_]{3,}", line):
            fail(f"{chapter_id}:{start}: unsupported block Markdown")
        if note_heading and current_note is None:
            fail(chapter_id + ": notes text appears before first definition")
        listing_match, quote, listing = LIST.match(lines[index]), line.startswith("> "), None
        if listing_match:
            marker = listing_match[2]
            listing = {"kind": "ordered" if marker[0].isdigit() else "unordered",
                       "level": len(listing_match[1]) // 2, "marker": marker, "sourceNumberId": chapter_id + "-list"}
            line = listing_match[3]
        if quote: line = line[2:]
        paragraph = [line]
        consumed.append(start)
        index += 1
        while index < len(lines) and lines[index].strip():
            upcoming = lines[index].strip()
            if HEADING.match(upcoming) or NOTE.match(upcoming) or LIST.match(lines[index]) or upcoming.startswith(("|", "```", "~~~", "![")):
                break
            if upcoming.startswith("> ") != quote: break
            paragraph.append(upcoming[2:] if quote else upcoming)
            consumed.append(index + 1)
            index += 1
        add("\n".join(paragraph), start, index, quote=quote, listing=listing)
        if current_note: current_note["sourceLines"][1] = index
    definitions = {note["number"] for note in notes}
    if set(references) != definitions:
        fail(f"{chapter_id}: note references/definitions differ: refs={sorted(set(references))}, defs={sorted(definitions)}")
    if any(not note["blocks"] for note in notes): fail(chapter_id + ": empty note")
    if set(consumed) != nonempty or len(consumed) != len(nonempty):
        fail(chapter_id + ": source line coverage failed")
    reconstructed = normalized("\n".join(block["text"] for block in blocks) + "\n" +
                               "\n".join(block["text"] for note in notes for block in note["blocks"]))
    expected = normalized("\n".join(source_segments))
    if reconstructed != expected: fail(chapter_id + ": reconstructed text differs in content or order")
    return blocks, notes, {"nonemptySourceLines": len(nonempty), "coveredSourceLines": len(consumed),
                          "noteCount": len(notes), "noteReferenceCount": len(references),
                          "notesHeading": note_heading or "Примечания",
                          "normalizedVisibleTextSha256": sha(expected.encode("utf-8")), "textRoundTrip": True}

def parse_contents(raw):
    parts, chapters, current = [], [], None
    for line in raw.decode("utf-8-sig").splitlines():
        part_match = re.fullmatch(r"## ([IVX]+)\. (.+)", line.strip())
        if part_match:
            current = {"id": f"part-{len(parts) + 1}", "number": part_match[1], "title": part_match[2]}
            parts.append(current)
        chapter_match = re.fullmatch(r"### (\d+)\. (.+)", line.strip())
        if chapter_match:
            if current is None: fail("Chapter appears before part")
            chapters.append({"number": int(chapter_match[1]), "title": chapter_match[2],
                             "part": f"Часть {current['number']}. {current['title']}"})
    if [c["number"] for c in chapters] != list(range(1, 19)) or len(parts) != 6:
        fail("Contents must define 18 numbered chapters in six parts")
    return parts, chapters

def build(manifest, raw_sources):
    release_hash = sha(canonical(manifest))
    parts, contents = parse_contents(raw_sources["contents"])
    chapters, notes, audit = [], [], {}
    selected = {entry["number"]: entry for entry in manifest.get("chapters", [])}
    def available(chapter_id, title, entry, number, part, kind):
        blocks, chapter_notes, document_audit = parse_document(raw_sources[chapter_id], chapter_id, title)
        chapters.append({"id": chapter_id, "number": number, "title": title, "part": part, "kind": kind,
                         "status": "available", "publicationStatus": "draft", "blocks": blocks,
                         "version": entry["version"], "editorialStatus": entry.get("editorialStatus", "working-draft"),
                         "source": {"path": entry["path"], "sha256": entry["sha256"].lower()},
                         "notesHeading": document_audit["notesHeading"]})
        notes.extend(chapter_notes)
        audit[chapter_id] = document_audit
    if manifest.get("preface"):
        available("preface", "Предисловие", manifest["preface"], None, None, "frontmatter")
    for definition in contents:
        number = definition["number"]
        chapter_id, title = f"chapter-{number:02d}", f"Глава {number}. {definition['title']}"
        if number in selected:
            available(chapter_id, title, selected[number], number, definition["part"], "chapter")
        else:
            chapters.append({"id": chapter_id, "number": number, "title": title, "part": definition["part"],
                             "kind": "chapter", "status": "planned", "publicationStatus": "draft", "blocks": []})
    all_blocks = [block for chapter in chapters for block in chapter["blocks"]]
    all_blocks += [block for note in notes for block in note["blocks"]]
    ids = [block["id"] for block in all_blocks] + [note["id"] for note in notes]
    if len(ids) != len(set(ids)): fail("Duplicate block or note id")
    text = "\n\n".join(block["text"] for block in all_blocks)
    book = {"schemaVersion": 2, "title": manifest["title"], "subtitle": manifest["subtitle"],
            "edition": manifest["edition"], "releaseId": manifest["releaseId"], "publicationStatus": "draft",
            "source": {"filename": "release-manifest.json", "format": "markdown_bundle", "sha256": release_hash,
                       "importer": "scripts/import-working-edition.py",
                       "textPolicy": "Зафиксированные авторские Markdown выбранных версий; доступны рабочие тексты, научная приёмка не присваивается импортом."},
            "parts": parts, "chapters": chapters, "notes": notes,
            "statistics": {"sections": len(chapters), "chapters": 18, "availableChapters": len(selected),
                           "plannedChapters": 18 - len(selected), "parts": 6, "blocks": len(all_blocks), "notes": len(notes),
                           "words": len(re.findall(r"\S+", text)), "characters": len(text)}}
    return book, {"releaseId": manifest["releaseId"], "manifestSha256": release_hash, "importerSha256": sha(Path(__file__).read_bytes()), "documents": audit,
                  "limitations": ["Only contents headings are selected from the editorial route; its complete source is frozen.",
                                  "Line coverage and visible-text round trips do not replace independent scientific review.",
                                  "Paragraph text, inline marks, links and note continuations are retained; typography can change."]}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="Validate selection and parse without writing")
    parser.add_argument("--check", action="store_true", help="Rebuild frozen sources and compare without writing")
    args = parser.parse_args()
    manifest_raw = args.manifest.read_bytes()
    manifest = json.loads(manifest_raw.decode("utf-8-sig"))
    validate_manifest(manifest)
    if args.check and args.dry_run: fail("--check and --dry-run are mutually exclusive")
    if not args.dry_run and args.output_dir is None: fail("--output-dir is required")
    source_root = args.output_dir.resolve(strict=True) if args.check else args.source_root.resolve(strict=True)
    frozen = {key: stable_read(source_root, entry) for key, entry in entries(manifest)}
    book, audit = build(manifest, frozen)
    for key, entry in entries(manifest):
        if stable_read(source_root, entry) != frozen[key]:
            fail("Source changed after parsing: " + entry["path"])
    if args.manifest.read_bytes() != manifest_raw: fail("Manifest changed while building")
    outputs = {"book.json": json_bytes(book), "audit.json": json_bytes(audit), "release-manifest.json": json_bytes(manifest), "importer/import-working-edition.py": Path(__file__).read_bytes()}
    if args.check:
        for filename, raw in outputs.items():
            if (source_root / filename).read_bytes() != raw: fail("Frozen output differs: " + filename)
    elif not args.dry_run:
        output = args.output_dir.resolve()
        if output.exists(): fail("Output already exists; use a fresh release path or --check")
        if output == ROOT / "src" / "data" or output.is_relative_to(ROOT / "public"):
            fail("Use a private snapshot path; publication is a separate step")
        output.parent.mkdir(parents=True, exist_ok=True)
        staging = Path(tempfile.mkdtemp(prefix=".working-edition-", dir=output.parent))
        try:
            for key, entry in entries(manifest):
                target = staging / entry["path"]
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(frozen[key])
            for filename, raw in outputs.items():
                (staging / filename).parent.mkdir(parents=True, exist_ok=True)
                (staging / filename).write_bytes(raw)
            os.replace(staging, output)
        finally:
            if staging.exists():
                checked = staging.resolve()
                if checked.parent != output.parent.resolve() or not checked.name.startswith(".working-edition-"):
                    fail("Unexpected staging cleanup path")
                shutil.rmtree(checked)
    print(json.dumps({"status": "CHECK OK" if args.check else "DRY RUN OK" if args.dry_run else "SNAPSHOT OK",
                      "releaseId": manifest["releaseId"], "manifestSha256": book["source"]["sha256"],
                      "availableChapters": book["statistics"]["availableChapters"],
                      "plannedChapters": book["statistics"]["plannedChapters"], "notes": book["statistics"]["notes"]}, ensure_ascii=False))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, UnicodeError) as error:
        print("IMPORT FAILED: " + str(error), file=sys.stderr)
        sys.exit(1)
