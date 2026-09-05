"""Build the current author prologue and verify its exact published text."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("manuscript/2026-09-05-rebuild/prologue-v1.0.md")
PREFIX = "prologue-v1-p"


def build_author_prologue():
    raw = (ROOT / SOURCE).read_bytes()
    sections = re.split(r"\n\s*\n", raw.decode("utf-8-sig").strip())
    if sections[0] != "# Пролог":
        raise ValueError("Unexpected prologue heading")
    paragraphs = [section.strip() for section in sections[1:]]
    if len(paragraphs) != 65 or paragraphs.count("⸻") != 4:
        raise ValueError("Prologue structure differs from the supplied author version")
    if re.search(r"https?://|\]\(|\[\^", "\n".join(paragraphs)):
        raise ValueError("The author requested a prologue without source links or notes")
    return {
        "id": "prologue",
        "number": None,
        "title": "Пролог",
        "part": None,
        "kind": "frontmatter",
        "contentKind": "manuscript",
        "status": "available",
        "publicationStatus": "published",
        "version": "1.0",
        "source": {"path": SOURCE.as_posix(), "sha256": hashlib.sha256(raw).hexdigest()},
        "blocks": [
            {"type": "paragraph", "id": f"{PREFIX}{index:03d}", "text": paragraph}
            for index, paragraph in enumerate(paragraphs, 1)
        ],
    }


class PublishedPrologue(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paragraphs = []
        self.current = None
        self.copy_depth = 0
        self.links = 0
        self.notes = 0
        self.title = []
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        if tag == "div":
            if self.copy_depth:
                self.copy_depth += 1
            elif "reading-copy" in classes:
                self.copy_depth = 1
        if self.copy_depth and tag == "a":
            self.links += 1
        if self.copy_depth and ("reading-notes" in classes or "note-reference" in classes):
            self.notes += 1
        if tag == "h1" and "reading-title" in classes:
            self.in_title = True
        if tag == "p" and attrs.get("id", "").startswith(PREFIX):
            self.current = []

    def handle_data(self, text):
        if self.current is not None:
            self.current.append(text)
        if self.in_title:
            self.title.append(text)

    def handle_endtag(self, tag):
        if tag == "p" and self.current is not None:
            self.paragraphs.append("".join(self.current))
            self.current = None
        if tag == "div" and self.copy_depth:
            self.copy_depth -= 1
        if tag == "h1":
            self.in_title = False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify src/data/book.json")
    parser.add_argument("--html", type=Path)
    parser.add_argument("--url")
    args = parser.parse_args()
    expected = build_author_prologue()
    if args.check:
        book = json.loads((ROOT / "src/data/book.json").read_text("utf-8"))
        chapter = next(c for c in book["chapters"] if c["id"] == "prologue")
        for field in ("title", "status", "version", "source", "blocks"):
            if chapter.get(field) != expected[field]:
                raise SystemExit(f"Prologue field differs: {field}")
        if any(n.get("chapterId") == "prologue" for n in book.get("notes", [])):
            raise SystemExit("Unexpected prologue notes")
        if any(c["id"] == "preface" for c in book["chapters"]):
            raise SystemExit("The current edition still lists the replaced preface")
    html = args.html.read_text("utf-8") if args.html else None
    if args.url:
        with urlopen(Request(args.url, headers={"Cache-Control": "no-cache"}), timeout=45) as response:
            if response.status != 200:
                raise SystemExit(f"Unexpected HTTP status: {response.status}")
            html = response.read().decode("utf-8")
    if html is not None:
        parsed = PublishedPrologue()
        parsed.feed(html)
        if parsed.paragraphs != [b["text"] for b in expected["blocks"]]:
            raise SystemExit(f"Published text differs: {len(parsed.paragraphs)}/65 blocks")
        if "".join(parsed.title).strip() != "Пролог":
            raise SystemExit("Published heading differs")
        if parsed.links or parsed.notes:
            raise SystemExit("Published prologue contains links or notes")
    print(json.dumps({
        "result": "CHECK OK",
        "blocks": len(expected["blocks"]),
        "paragraphs": 61,
        "separators": 4,
        "sourceSha256": expected["source"]["sha256"],
        "htmlVerified": html is not None,
        "noSourceLinks": True,
    }, ensure_ascii=True))


if __name__ == "__main__":
    main()
