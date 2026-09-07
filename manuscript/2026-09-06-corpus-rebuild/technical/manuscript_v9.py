"""Strict v9 Markdown projection with chapter notes and simple tables.

The accepted sources are never rewritten. All visible text and note paragraphs
remain in their source order; only Markdown structure becomes reader data.
"""
from __future__ import annotations
import re
import manuscript_markdown as legacy

NOTE_HEADING = re.compile(r"(?m)^## (Источники?[^\n]*|Примечани[ея][^\n]*)$")
NOTE_START = re.compile(r"^\s*(?:\[(\d+)\]|(\d+)\.)\s+(.+)$")


def inline(text, note_ids=None):
    # The legacy parser correctly handles links, emphasis, code and adjacent
    # numerical markers. Bind only literal note markers, never link labels.
    result = []
    for run in legacy.inline(text, {}):
        if run.get("href") or run.get("code") or note_ids is None:
            result.append(run)
            continue
        position = 0
        for marker in re.finditer(r"\[(\d+)\]", run["text"]):
            if marker[1] not in note_ids:
                raise ValueError("Undefined chapter note: " + marker[1])
            if marker.start() > position:
                result.append({**run, "text": run["text"][position:marker.start()]})
            result.append({**run, "text": marker[0], "noteId": note_ids[marker[1]]})
            position = marker.end()
        if position < len(run["text"]):
            result.append({**run, "text": run["text"][position:]})
    return result


def parse_blocks(text, prefix, note_ids=None):
    blocks = []
    for chunk in re.split(r"\n\s*\n", text.strip()):
        if not chunk.strip():
            continue
        chunk = chunk.strip()
        ident = f"{prefix}-p{len(blocks)+1:03d}"
        heading = re.fullmatch(r"(#{2,3}) ([^\n]+)", chunk)
        if chunk.startswith("|"):
            lines = chunk.splitlines()
            cells = lambda line: [cell.strip() for cell in line.strip().strip("|").split("|")]
            if len(lines) < 3 or not all(re.fullmatch(r":?-{3,}:?", c) for c in cells(lines[1])):
                raise ValueError("Malformed Markdown table")
            raw_rows = [cells(line) for index, line in enumerate(lines) if index != 1]
            if any(len(row) != len(raw_rows[0]) for row in raw_rows):
                raise ValueError("Unequal Markdown table row widths")
            runs = [[inline(cell, note_ids) for cell in row] for row in raw_rows]
            blocks.append({"type": "table", "id": ident,
                           "rows": [["".join(r["text"] for r in cell) for cell in row] for row in runs],
                           "cellLayout": [[{"colSpan": 1, "verticalMerge": None} for _ in row] for row in raw_rows],
                           "cellRuns": runs})
            continue
        list_matches = [re.fullmatch(r"(\d+\.|[-+*]) (.+)", line) for line in chunk.splitlines()]
        if all(list_matches):
            for match in list_matches:
                ordered = match[1][0].isdigit()
                runs = inline(match[2], note_ids)
                blocks.append({"type": "paragraph", "id": f"{prefix}-p{len(blocks)+1:03d}",
                               "text": "".join(r["text"] for r in runs), "runs": runs,
                               "list": {"kind": "ordered" if ordered else "unordered", "level": 0,
                                        "marker": match[1] if ordered else "•", "sourceNumberId": ident + "-list"}})
            continue
        separator = bool(re.fullmatch(r"(?:---+|\*\*\*+|⸻)", chunk))
        if not heading and not separator and re.search(r"(?m)^(?:#{1,6} |```|~~~|[-*+] |\d+\. |!\[|\[\^|>|\|)", chunk):
            raise ValueError("Unsupported v9 Markdown: " + chunk[:90])
        value = heading[2] if heading else "⸻" if separator else chunk
        runs = inline(value, note_ids)
        block = {"type": "heading" if heading else "paragraph", "id": ident,
                 "text": "".join(r["text"] for r in runs)}
        if heading:
            block["level"] = len(heading[1])
        if any(len(r) > 1 for r in runs):
            block["runs"] = runs
        if separator:
            block["role"] = "separator"
        blocks.append(block)
    return blocks


def parse(raw, identifier, expected_title=None):
    text = raw.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n").strip()
    first, _, body = text.partition("\n")
    if not first.startswith("# ") or not body.strip():
        raise ValueError(identifier + ": title and prose required")
    title = first[2:]
    clean = lambda value: re.sub(r"^Глава \d+\.\s*", "", value).rstrip(".")
    if expected_title and clean(title) != clean(expected_title):
        raise ValueError(identifier + ": title differs from the selected source")
    heading = NOTE_HEADING.search(body)
    note_defs, general, current = {}, [], None
    if heading:
        main = body[:heading.start()].strip()
        footer = body[heading.end():].strip()
        for line in footer.splitlines():
            match = NOTE_START.fullmatch(line)
            if match:
                current = match[1] or match[2]
                if current in note_defs:
                    raise ValueError(identifier + ": duplicate note " + current)
                note_defs[current] = [match[3]]
            elif current is not None:
                note_defs[current].append(line)
            else:
                general.append(line)
    else:
        main = body
    prefix = "manuscript-v9-" + identifier
    note_ids = {number: prefix + "-note-" + number for number in note_defs}
    blocks = parse_blocks(main, prefix, note_ids)
    if not any(b["type"] == "paragraph" and b.get("role") != "separator" for b in blocks):
        raise ValueError(identifier + ": source requires narrative prose")
    if heading and any(line.strip() for line in general):
        blocks += parse_blocks("## " + heading[1] + "\n\n" + "\n".join(general).strip(), prefix + "-apparatus")
    notes = [{"id": note_ids[number], "kind": "endnote", "chapterId": identifier,
              "number": int(number), "sourceId": number,
              "blocks": parse_blocks("\n".join(lines).strip(), note_ids[number])}
             for number, lines in note_defs.items()]
    used = {r["noteId"] for b in blocks for r in b.get("runs", []) if "noteId" in r}
    if used != set(note_ids.values()):
        raise ValueError(identifier + ": note references and definitions differ")
    return title, blocks, notes, heading[1] if heading else None