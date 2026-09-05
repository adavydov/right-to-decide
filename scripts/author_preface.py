"""Publish the author-supplied preface; keep the DOCX edition reproducible."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("manuscript/2026-09-05-rebuild/preface-v8.0.md")


def apply_author_preface(book):
    raw = (ROOT / SOURCE).read_bytes()
    sections = re.split(r"\n\s*\n", raw.decode("utf-8-sig").strip())
    if sections[0] != "# Предисловие":
        raise ValueError("Unexpected preface heading")
    paragraphs = [section.strip() for section in sections[1:]]
    chapter = next(c for c in book["chapters"] if c["id"] == "preface")
    chapter.update(
        title="Предисловие",
        version="8.0",
        publicationStatus="published",
        source={"path": SOURCE.as_posix(), "sha256": hashlib.sha256(raw).hexdigest()},
        blocks=[
            {"type": "paragraph", "id": f"preface-v8-p{index:03d}", "text": paragraph}
            for index, paragraph in enumerate(paragraphs, 1)
        ],
    )
    book["source"]["textPolicy"] = (
        "Текст авторской рукописи без редакторского изменения; формулы представлены "
        "линейной записью с сохранением исходного OMML. Авторские замены отдельных "
        "разделов указаны в chapter.source; их источник хранится отдельно от DOCX."
    )
    blocks = [b for c in book["chapters"] for b in c["blocks"]]
    text = "\n".join(
        b.get("text", "\n".join("\t".join(row) for row in b.get("rows", [])))
        for b in blocks
    )
    book["statistics"].update(
        blocks=len(blocks), words=len(re.findall(r"\S+", text)), characters=len(text)
    )
    return chapter


class PublishedParagraphs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paragraphs = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag == "p" and (dict(attrs).get("id") or "").startswith("preface-v8-p"):
            self.current = []

    def handle_data(self, text):
        if self.current is not None:
            self.current.append(text)

    def handle_endtag(self, tag):
        if tag == "p" and self.current is not None:
            self.paragraphs.append("".join(self.current))
            self.current = None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--html", type=Path)
    parser.add_argument("--url")
    args = parser.parse_args()
    destination = ROOT / "src/data/book.json"
    before = destination.read_text("utf-8")
    book = json.loads(before)
    chapter = apply_author_preface(book)
    serialized = json.dumps(book, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if before != serialized:
            raise SystemExit("Preface projection differs from the author source")
    else:
        destination.write_text(serialized, encoding="utf-8", newline="\n")
    html = None
    if args.html:
        html = args.html.read_text("utf-8")
    if args.url:
        request = Request(args.url, headers={"Cache-Control": "no-cache"})
        with urlopen(request, timeout=45) as response:
            if response.status != 200:
                raise SystemExit(f"Unexpected HTTP status: {response.status}")
            html = response.read().decode("utf-8")
    if html is not None:
        parsed = PublishedParagraphs()
        parsed.feed(html)
        expected = [block["text"] for block in chapter["blocks"]]
        if parsed.paragraphs != expected:
            raise SystemExit(
                f"Published preface mismatch: {len(parsed.paragraphs)}/{len(expected)} paragraphs"
            )
    print(json.dumps({
        "result": "CHECK OK" if args.check else "IMPORT OK",
        "paragraphs": len(chapter["blocks"]),
        "separators": sum(b["text"] == "⸻" for b in chapter["blocks"]),
        "sourceSha256": chapter["source"]["sha256"],
        "htmlVerified": html is not None,
    }, ensure_ascii=True))


if __name__ == "__main__":
    main()
