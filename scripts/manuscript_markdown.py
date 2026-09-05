"""Small, strict Markdown contract shared by the reader and chapter DOCX export.

Supports prose, ##/### headings, emphasis, inline/reference HTTPS links, ordered
or unordered lists and thematic breaks. Rejects unsupported syntax before release.
"""
from __future__ import annotations

import re
from urllib.parse import urlsplit


def safe_url(value: str) -> str:
    parsed = urlsplit(value)
    if (parsed.scheme not in {"https", "http"} or not parsed.netloc or parsed.username
            or parsed.password or re.search(r"[\s\\\x00-\x1f]", value)):
        raise ValueError("Source links must be public HTTP(S) URLs without credentials")
    return value


def inline(value: str, references: dict[str, str]) -> list[dict]:
    runs = []
    pattern = re.compile(r"\[([^\]\n]+)\]\(([^\s]+)\)|\[([^\]\n]+)\]\[([^\]\n]+)\]|\*\*(.+?)\*\*|(?<!\*)\*([^*\n]+)\*(?!\*)|`([^`\n]+)`")
    position = 0
    for match in pattern.finditer(value):
        if match.start() > position:
            runs.append({"text": value[position:match.start()]})
        if match[1] is not None or match[3] is not None:
            label = match[1] or match[3]
            target = match[2] if match[1] is not None else references.get(match[4].casefold())
            if not target and match[3] is not None and match[3].isdigit() and match[4].isdigit():
                # Adjacent numbered note markers are literal unless a reference is defined.
                runs.append({"text": match[0]})
            elif not target:
                raise ValueError("Undefined Markdown reference: " + str(match[4]))
            else:
                runs.extend({**run, "href": safe_url(target)} for run in inline(label, references))
        elif match[5] is not None:
            runs.extend({**run, "strong": True} for run in inline(match[5], references))
        elif match[6] is not None:
            runs.extend({**run, "emphasis": True} for run in inline(match[6], references))
        else:
            runs.append({"text": match[7], "code": True})
        position = match.end()
    if position < len(value):
        runs.append({"text": value[position:]})
    for run in runs:
        checked = re.sub(r"\[\d+\](?:\[\d+\])+", "", run["text"])
        if re.search(r"!?\[[^\]]*\](?:\(|\[)|\[\^|\*\*|(?<!\w)_[^_]+_(?!\w)", checked):
            raise ValueError("Unsupported or malformed inline Markdown: " + run["text"][:80])
    return runs or [{"text": ""}]


def parse(raw: bytes, identifier: str, expected_title: str | None = None) -> tuple[str, list[dict]]:
    text = raw.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n").strip()
    references = {}
    lines = []
    for line in text.splitlines():
        reference = re.fullmatch(r'\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+"[^"\n]*")?\s*', line)
        if reference:
            key = reference[1].casefold()
            if key in references:
                raise ValueError("Duplicate Markdown reference: " + key)
            references[key] = safe_url(reference[2])
        else:
            lines.append(line)
    chunks = [chunk.strip() for chunk in re.split(r"\n\s*\n", "\n".join(lines).strip())]
    heading = re.fullmatch(r"# ([^\n]+)", chunks[0])
    if not heading:
        raise ValueError(identifier + ": source must start with a single # title")
    title = heading[1]
    if expected_title:
        clean = lambda s: re.sub(r"^Глава \d+\.\s*", "", s).rstrip(".")
        if clean(title) != clean(expected_title):
            raise ValueError(identifier + ": title differs from the constitution outline")
        number = re.match(r"Глава (\d+)\.", title)
        expected_number = re.match(r"Глава (\d+)\.", expected_title)
        if number and expected_number and number[1] != expected_number[1]:
            raise ValueError(identifier + ": chapter number differs from the outline")
    blocks = []

    def append(value, *, level=None, list_info=None, separator=False):
        runs = inline(value, references)
        block = {"type": "heading" if level else "paragraph", "id": f"manuscript-v6-{identifier}-p{len(blocks)+1:03d}",
                 "text": "".join(run["text"] for run in runs)}
        if level:
            block["level"] = level
        if any(len(run) > 1 for run in runs):
            block["runs"] = runs
        if list_info:
            block["list"] = list_info
        if separator:
            block["role"] = "separator"
        blocks.append(block)

    for index, chunk in enumerate(chunks[1:], 1):
        if re.fullmatch(r"(?:---+|\*\*\*+|⸻)", chunk):
            append("⸻", separator=True)
            continue
        subheading = re.fullmatch(r"(#{2,3}) ([^\n]+)", chunk)
        if subheading:
            append(subheading[2], level=len(subheading[1]))
            continue
        list_matches = [re.fullmatch(r"(\d+\.|[-+*]) (.+)", line) for line in chunk.splitlines()]
        if all(list_matches):
            first_kind = "ordered" if list_matches[0][1][0].isdigit() else "unordered"
            for match in list_matches:
                kind = "ordered" if match[1][0].isdigit() else "unordered"
                if kind != first_kind:
                    raise ValueError(identifier + ": separate lists with a blank line")
                append(match[2], list_info={"kind": kind, "level": 0, "marker": match[1] if kind == "ordered" else "•",
                                           "sourceNumberId": f"{identifier}-list-{index}"})
            continue
        if re.search(r"(?m)^(?:#{1,6} |```|~~~|[-*+] |\d+\. |!\[|\[\^|>|\|)", chunk):
            raise ValueError(identifier + f": unsupported Markdown in block {index}")
        append(chunk)
    if not any(b["type"] == "paragraph" and b.get("role") != "separator" for b in blocks):
        raise ValueError(identifier + ": chapter needs prose")
    return title, blocks
