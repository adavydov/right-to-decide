"""Compare reader HTML with the exact selected literary text in book.json.

python scripts/verify-literary-release.py --html-dir out --chapters 1-3
python scripts/verify-literary-release.py --url https://adavydov.github.io/right-to-decide --chapters 1-3
Without --chapters, verify every available numbered manuscript chapter.
The prologue has its own verifier: scripts/author_prologue.py.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "literary-v4-"
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


def display_title(value: str) -> str:
    """Match the heading presentation in src/lib/book-display.ts."""
    clean = re.sub(r"\s+", " ", value.strip())
    if clean != clean.upper():
        return clean
    clean = clean[:1] + clean[1:].lower()
    clean = re.sub(r"(?<![а-яё])(ии|рут|миит|ссср|рф)(?![а-яё])", lambda m: m[0].upper(), clean)
    clean = re.sub(r"\b(cdio|stem|abet|llm|mit)\b", lambda m: m[0].upper(), clean, flags=re.ASCII)
    clean = re.sub(r"^Часть ([ivxlcdm]+)\.", lambda m: "Часть " + m[1].upper() + ".", clean)
    clean = re.sub(r"^(Приложение )([а-яё])\.", lambda m: m[1] + m[2].upper() + ".", clean)
    clean = re.sub(r"^((?:Глава \d+|Часть [IVXLCDM]+|Приложение [А-ЯЁ])\.\s*)([а-яёa-z])", lambda m: m[1] + m[2].upper(), clean)
    return re.sub(r"^(\d+(?:\.\d+)*\.?\s+)([а-яёa-z])", lambda m: m[1] + m[2].upper(), clean)


class ReaderText(HTMLParser):
    """Read actual reader elements, excluding hydration scripts and hidden markup."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.capture = None
        self.blocks = []
        self.titles = []
        self.copy_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        parent = self.stack[-1] if self.stack else {"copy": False, "hidden": False, "ignored": False}
        style = re.sub(r"\s+", "", attrs.get("style", "")).lower()
        hidden = parent["hidden"] or "hidden" in attrs or attrs.get("aria-hidden") == "true" or bool(re.search(r"(?:^|;)(?:display:none|visibility:hidden)(?:!important)?(?:;|$)", style))
        ignored = parent["ignored"] or tag in {"script", "style", "template"}
        is_copy = tag == "div" and "reading-copy" in attrs.get("class", "").split()
        inside_copy = parent["copy"] or is_copy
        if is_copy:
            self.copy_count += 1
            if hidden or ignored:
                raise ValueError("The reader body is hidden")
        identifier = attrs.get("id", "")
        if identifier.startswith(PREFIX) and not ignored:
            if not inside_copy or tag not in {"p", "h2", "h3"}:
                raise ValueError("Literary block is outside its expected reader element: " + identifier)
        title = tag == "h1" and "reading-title" in attrs.get("class", "").split() and not ignored
        block = inside_copy and tag in {"p", "h1", "h2", "h3", "h4", "h5", "h6"} and not ignored
        if title or block:
            if hidden:
                raise ValueError("Reader text is hidden: " + (identifier or tag))
            if self.capture is not None:
                raise ValueError("Nested reader text elements")
            self.capture = {"tag": tag, "id": identifier, "title": title,
                            "depth": len(self.stack) + 1, "text": []}
        if tag not in VOID_TAGS:
            self.stack.append({"tag": tag, "copy": inside_copy, "hidden": hidden, "ignored": ignored})

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_data(self, data):
        current = self.stack[-1] if self.stack else None
        if not current or current["ignored"] or current["hidden"]:
            return
        if self.capture is not None:
            self.capture["text"].append(data)
        elif current["copy"] and data.strip():
            raise ValueError("Unexpected reader text outside a paragraph or heading")

    def handle_endtag(self, tag):
        if tag in VOID_TAGS:
            return
        if self.capture is not None and self.capture["tag"] == tag and self.capture["depth"] == len(self.stack):
            text = "".join(self.capture["text"])
            if self.capture["title"]:
                self.titles.append(text)
            else:
                self.blocks.append((self.capture["id"], tag, text))
            self.capture = None
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index]["tag"] == tag:
                del self.stack[index:]
                break


def verify_html(chapter: dict, html: str) -> int:
    expected = []
    for block in chapter["blocks"]:
        if not block["id"].startswith(PREFIX + chapter["id"] + "-"):
            raise ValueError("Unexpected literary source ID: " + block["id"])
        if block["type"] == "paragraph":
            tag, text = "p", block["text"]
        elif block["type"] == "heading":
            tag = "h2" if (block.get("level") or 2) <= 2 else "h3"
            text = display_title(block["text"])
        else:
            raise ValueError("Unsupported literary block type: " + block["type"])
        expected.append((block["id"], tag, text))
    if not expected:
        raise ValueError("An available literary chapter has no blocks")
    parsed = ReaderText()
    parsed.feed(html)
    parsed.close()
    if parsed.capture is not None:
        raise ValueError("Unclosed reader text element")
    if parsed.copy_count != 1:
        raise ValueError(f"Expected one reader body, found {parsed.copy_count}")
    if parsed.titles != [display_title(chapter["title"])]:
        raise ValueError("The visible chapter title differs")
    if len(parsed.blocks) != len(expected):
        raise ValueError(f"Block count differs: {len(parsed.blocks)}/{len(expected)}")
    for index, (actual, wanted) in enumerate(zip(parsed.blocks, expected), 1):
        if actual != wanted:
            if actual[:2] != wanted[:2]:
                raise ValueError(f"Block {index} ID, order or element differs: {actual[:2]} / {wanted[:2]}")
            raise ValueError(f"Text differs in block {wanted[0]}")
    return len(expected)


def select_chapters(book: dict, selection: str | None) -> list[dict]:
    available = {int(c["number"]): c for c in book["chapters"]
                 if c["kind"] == "chapter" and c["status"] == "available" and c.get("contentKind") == "manuscript"}
    if not selection:
        numbers = sorted(available)
    else:
        numbers = []
        for part in selection.split(","):
            match = re.fullmatch(r"\s*(\d+)(?:-(\d+))?\s*", part)
            if not match:
                raise ValueError("Use chapter numbers or ranges, for example 1-3,5")
            start, end = int(match[1]), int(match[2] or match[1])
            if not 1 <= start <= end <= 18:
                raise ValueError("Chapter range must be within 1-18")
            numbers.extend(range(start, end + 1))
        if len(numbers) != len(set(numbers)):
            raise ValueError("Duplicate selected chapter")
        numbers.sort()
    if not numbers:
        raise ValueError("No available numbered literary chapters to verify")
    missing = [number for number in numbers if number not in available]
    if missing:
        raise ValueError("Selected chapters are not available literary text: " + ", ".join(map(str, missing)))
    return [available[number] for number in numbers]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html-dir", type=Path, help="Static export directory, usually out")
    parser.add_argument("--url", help="Published base URL, including /right-to-decide if needed")
    parser.add_argument("--chapters", help="Optional selection such as 1-3; default: every available literary chapter")
    parser.add_argument("--book", type=Path, default=ROOT / "src/data/book.json")
    args = parser.parse_args()
    if not args.html_dir and not args.url:
        parser.error("Specify --html-dir and/or --url")
    if args.url:
        address = urlsplit(args.url)
        if address.scheme not in {"http", "https"} or not address.netloc or address.username or address.password or address.query or address.fragment:
            parser.error("--url must be an HTTP(S) base URL without credentials, query or fragment")
    try:
        book = json.loads(args.book.read_text("utf-8-sig"))
        chapters = select_chapters(book, args.chapters)
        for chapter in chapters:
            if not re.fullmatch(r"chapter-\d{2}", chapter["id"]):
                raise ValueError("Unexpected chapter route ID")
            route = f"read/{chapter['id']}/"
            if args.html_dir:
                count = verify_html(chapter, (args.html_dir / route / "index.html").read_text("utf-8"))
                print(f"LOCAL OK {chapter['id']} {count} blocks")
            if args.url:
                request = Request(args.url.rstrip("/") + "/" + route, headers={"Cache-Control": "no-cache", "Pragma": "no-cache"})
                with urlopen(request, timeout=45) as response:
                    if response.status != 200:
                        raise ValueError(f"HTTP {response.status} for {chapter['id']}")
                    html = response.read().decode("utf-8")
                count = verify_html(chapter, html)
                print(f"PUBLIC OK {chapter['id']} {count} blocks")
        print(f"LITERARY TEXT VERIFIED: {len(chapters)} chapters")
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
