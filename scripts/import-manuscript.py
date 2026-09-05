#!/usr/bin/env python3
"""Faithful DOCX import using only Python's standard library.
Usage: python scripts/import-manuscript.py PATH.docx --edition 2026-09-04 [--check]
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import date
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import struct
import sys
from xml.etree import ElementTree as ET
from zipfile import ZipFile

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
M = "{http://schemas.openxmlformats.org/officeDocument/2006/math}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
TEXT_TAGS = {W + "t", M + "t"}
ROOT = Path(__file__).resolve().parents[1]
SECTION_IDS = {
    "СВЕДЕНИЯ ОБ ИЗДАНИИ": ("edition", "frontmatter"),
    "СВЕДЕНИЯ ОБ АВТОРАХ": ("authors", "frontmatter"),
    "АННОТАЦИЯ": ("abstract", "frontmatter"),
    "АННОТАЦИЯ НА АНГЛИЙСКОМ ЯЗЫКЕ": ("abstract-en", "frontmatter"),
    "ПРЕДИСЛОВИЕ": ("preface", "frontmatter"),
    "СПИСОК СОКРАЩЕНИЙ И ОБОЗНАЧЕНИЙ": ("abbreviations", "frontmatter"),
    "ОГЛАВЛЕНИЕ": ("source-contents", "frontmatter"),
    "ВВЕДЕНИЕ": ("introduction", "frontmatter"),
    "ЗАКЛЮЧЕНИЕ": ("conclusion", "backmatter"),
    "СПИСОК ЛИТЕРАТУРЫ": ("references", "backmatter"),
}
APPENDIX_IDS = dict(zip("АБВГДЕЖЗИК", ["a", "b", "v", "g", "d", "e", "zh", "z", "i", "k"]))

def value(element, default=""):
    return default if element is None else element.get(W + "val", default)

class Importer:
    def __init__(self, archive):
        self.archive = archive
        self.document = ET.fromstring(archive.read("word/document.xml"))
        self.styles = {i.get(W+"styleId"): i for i in ET.fromstring(archive.read("word/styles.xml")) if i.tag == W+"style"}
        self.relationships = {i.get("Id"): i for i in ET.fromstring(archive.read("word/_rels/document.xml.rels"))}
        numbering = ET.fromstring(archive.read("word/numbering.xml")) if "word/numbering.xml" in archive.namelist() else ET.Element("empty")
        self.abstract_numbers = {i.get(W+"abstractNumId"): i for i in numbering if i.tag == W+"abstractNum"}
        self.numbers = {i.get(W+"numId"): i for i in numbering if i.tag == W+"num"}
        self.list_counts = {}
        self.consumed = Counter()
        self.assets = {}
        self.counts = Counter()
        self.chapters, self.parts = [], []
        self.current = self.part = None

    def style_property(self, style_id, path):
        seen = set()
        while style_id and style_id not in seen:
            seen.add(style_id)
            style = self.styles.get(style_id)
            if style is None: break
            prop = style.find(path)
            if prop is not None: return prop
            style_id = value(style.find(W+"basedOn"))
        return None

    def plain(self, element, consume=True):
        if element.tag in TEXT_TAGS:
            if consume: self.consumed[id(element)] += 1
            return element.text or ""
        if element.tag == W+"tab": return "\t"
        if element.tag in {W+"br", W+"cr"}: return "\n"
        if element.tag == W+"noBreakHyphen": return "\u2011"
        if element.tag in {W+"softHyphen", W+"instrText", W+"delText"}: return ""
        if element.tag in {W+"footnoteReference", W+"endnoteReference"}:
            kind = "footnote" if element.tag == W+"footnoteReference" else "endnote"
            return f"[{kind}:{element.get(W+'id')}]"
        if element.tag == M+"d":
            properties = element.find(M+"dPr")
            def delimiter(name, default):
                node = properties.find(M+name) if properties is not None else None
                return node.get(M+"val", default) if node is not None else default
            expressions = [self.plain(child, consume) for child in element if child.tag != M+"dPr"]
            return delimiter("begChr", "(") + delimiter("sepChr", "|").join(expressions) + delimiter("endChr", ")")
        chunks = []
        for child in element:
            rendered = self.plain(child, consume)
            if element.tag in {M+"sSub", M+"sSup", M+"sSubSup"} and child.tag == M+"sub":
                rendered = "_{" + rendered + "}"
            elif element.tag in {M+"sSub", M+"sSup", M+"sSubSup"} and child.tag == M+"sup":
                rendered = "^{" + rendered + "}"
            elif element.tag == M+"f" and child.tag == M+"num":
                rendered = "(" + rendered + ")"
            elif element.tag == M+"f" and child.tag == M+"den":
                rendered = "/(" + rendered + ")"
            chunks.append(rendered)
        return "".join(chunks)

    def list_meta(self, paragraph, style_id):
        numpr = paragraph.find(W+"pPr/"+W+"numPr")
        if numpr is None: numpr = self.style_property(style_id, W+"pPr/"+W+"numPr")
        if numpr is None: return None
        num_id = value(numpr.find(W+"numId"))
        if not num_id or num_id == "0" or num_id not in self.numbers: return None
        level = int(value(numpr.find(W+"ilvl"), "0"))
        num = self.numbers[num_id]
        abstract = self.abstract_numbers.get(value(num.find(W+"abstractNumId")))
        if abstract is None: raise ValueError(f"Missing numbering definition {num_id}")
        definition = abstract.find(f"{W}lvl[@{W}ilvl='{level}']")
        override = num.find(f"{W}lvlOverride[@{W}ilvl='{level}']")
        if override is not None and override.find(W+"lvl") is not None: definition = override.find(W+"lvl")
        if definition is None: raise ValueError(f"Missing list level {level}")
        fmt = value(definition.find(W+"numFmt"), "decimal")
        template = value(definition.find(W+"lvlText"), "%1.")
        start = int(value(definition.find(W+"start"), "1"))
        if override is not None: start = int(value(override.find(W+"startOverride"), str(start)))
        key = (num_id, level)
        self.list_counts[key] = self.list_counts.get(key, start-1) + 1
        for previous in list(self.list_counts):
            if previous[0] == num_id and previous[1] > level: del self.list_counts[previous]
        if fmt == "bullet":
            marker = "•" if template in {"\uf0b7", "\uf0a7"} else template
        else:
            marker = re.sub(r"%(\d+)", lambda m: str(self.list_counts.get((num_id, int(m[1])-1), start)), template)
        self.counts["listParagraphs"] += 1
        return {"kind": "unordered" if fmt == "bullet" else "ordered", "level": level, "marker": marker, "sourceNumberId": num_id}

    def new_section(self, text):
        normalized = " ".join(text.split())
        part_match = re.match(r"^ЧАСТЬ ([IVX]+)\.", normalized)
        if part_match:
            self.part = text
            self.parts.append({"id": "part-"+part_match[1].lower(), "number": part_match[1], "title": text})
            return True
        match = re.match(r"^ГЛАВА (\d+)\.", normalized)
        appendix = re.match(r"^ПРИЛОЖЕНИЕ ([А-Я])\.", normalized)
        number = None
        if match:
            number = int(match[1])
            section_id, kind = f"chapter-{number:02d}", "chapter"
        elif appendix:
            number = appendix[1]
            section_id, kind = "appendix-"+APPENDIX_IDS.get(number, str(ord(number))), "appendix"
            self.part = None
        elif normalized in SECTION_IDS:
            section_id, kind = SECTION_IDS[normalized]
            if kind == "backmatter": self.part = None
        else: return False
        self.current = {"id": section_id, "number": number, "title": text, "part": self.part, "kind": kind, "status": "available", "publicationStatus": "draft", "blocks": []}
        self.chapters.append(self.current)
        return True

    def images(self, paragraph, source_id, next_text):
        result = []
        for blip in paragraph.iter(A+"blip"):
            relation = self.relationships.get(blip.get(R+"embed"))
            if relation is None or relation.get("TargetMode") == "External": raise ValueError("Unresolved or external image")
            target = PurePosixPath(relation.get("Target", ""))
            if target.is_absolute() or ".." in target.parts: raise ValueError("Unexpected image path")
            payload = self.archive.read("word/"+str(target))
            self.assets[target.name] = payload
            block = {"type": "image", "id": source_id+"-image-"+str(len(result)+1), "src": "/book/figures/"+target.name, "alt": next_text if next_text.startswith("Рисунок") else "Рисунок из монографии"}
            if payload.startswith(b"\x89PNG\r\n\x1a\n"): block["width"], block["height"] = struct.unpack(">II", payload[16:24])
            result.append(block)
        return result

    def paragraph(self, paragraph, source_id, allow_sections, next_text=""):
        self.counts["paragraphsInSource"] += 1
        text = self.plain(paragraph)
        style_id = value(paragraph.find(W+"pPr/"+W+"pStyle"))
        outline = paragraph.find(W+"pPr/"+W+"outlineLvl")
        if outline is None: outline = self.style_property(style_id, W+"pPr/"+W+"outlineLvl")
        level = int(value(outline, "9")) + 1
        blocks = []
        if text.strip():
            is_section = allow_sections and level == 1 and self.new_section(text)
            if not is_section:
                block = {"type": "heading" if level <= 6 else "paragraph", "id": source_id, "text": text}
                if block["type"] == "heading": block["level"] = level
                if style_id == "affff5": block["type"], block["level"] = "heading", 3
                style_name = value(self.styles[style_id].find(W+"name")) if style_id in self.styles else ""
                if "цитат" in style_name.lower() or "quote" in style_name.lower(): block["role"] = "quote"
                elif text.lstrip().startswith(("Рисунок ", "Таблица ")): block["role"] = "caption"
                listing = self.list_meta(paragraph, style_id)
                if listing: block["list"] = listing
                formulas = list(paragraph.iter(M+"oMath"))
                if formulas:
                    self.counts["mathExpressions"] += len(formulas)
                    block["math"] = [{"text": self.plain(f, False), "omml": ET.tostring(f, encoding="unicode")} for f in formulas]
                blocks.append(block)
        else: self.counts["emptyParagraphsOmitted"] += 1
        blocks.extend(self.images(paragraph, source_id, next_text))
        return blocks

    def table(self, table, source_id):
        self.counts["tables"] += 1
        rows, spans = [], []
        for row in table.findall(W+"tr"):
            cells, row_spans = [], []
            for cell in row.findall(W+"tc"):
                paragraphs = []
                for index, paragraph in enumerate(cell.findall(W+"p")):
                    for block in self.paragraph(paragraph, f"{source_id}-r{len(rows)+1}-c{len(cells)+1}-p{index+1}", False):
                        if block["type"] == "image": raise ValueError("Table image requires cell-block renderer")
                        prefix = block.get("list", {}).get("marker", "")
                        paragraphs.append((prefix+" " if prefix else "")+block["text"])
                if cell.find(W+"tbl") is not None: raise ValueError("Nested table requires cell-block renderer")
                cells.append("\n".join(paragraphs))
                merge = cell.find(W+"tcPr/"+W+"vMerge")
                row_spans.append({"colSpan": int(value(cell.find(W+"tcPr/"+W+"gridSpan"), "1")), "verticalMerge": value(merge, "continue") if merge is not None else None})
            rows.append(cells)
            spans.append(row_spans)
        return {"type": "table", "id": source_id, "rows": rows, "cellLayout": spans}

    def walk(self, container, prefix="body", in_sdt=False):
        children = list(container)
        for index, element in enumerate(children):
            source_id = f"{prefix}-{index+1:04d}"
            if element.tag == W+"p":
                next_text = self.plain(children[index+1], False).strip() if index+1 < len(children) else ""
                blocks = self.paragraph(element, source_id, not in_sdt, next_text)
            elif element.tag == W+"tbl": blocks = [self.table(element, source_id)]
            elif element.tag == W+"sdt":
                content = element.find(W+"sdtContent")
                if content is not None: self.walk(content, source_id+"-sdt", True)
                continue
            else: continue
            if blocks:
                if self.current is None: raise ValueError("Text before first recognized section")
                self.current["blocks"].extend(blocks)

    def notes(self):
        notes = []
        for kind, filename in [("footnote", "word/footnotes.xml"), ("endnote", "word/endnotes.xml")]:
            if filename not in self.archive.namelist(): continue
            root = ET.fromstring(self.archive.read(filename))
            for item in root:
                if item.get(W+"type") in {"separator", "continuationSeparator"}: continue
                blocks = []
                for index, paragraph in enumerate(item.findall(W+"p")):
                    blocks.extend(self.paragraph(paragraph, f"{kind}-{item.get(W+'id')}-p{index+1}", False))
                notes.append({"id": kind+":"+item.get(W+"id", ""), "kind": kind, "blocks": blocks})
        return notes

    def run(self):
        body = self.document.find(W+"body")
        if body is None: raise ValueError("DOCX has no body")
        self.walk(body)
        nodes = [node for node in body.iter() if node.tag in TEXT_TAGS]
        missing = [node for node in nodes if self.consumed[id(node)] != 1]
        if missing: raise ValueError(f"Text coverage failed: {len(missing)} text nodes not consumed exactly once")
        ids = [c["id"] for c in self.chapters]
        if len(ids) != len(set(ids)): raise ValueError("Duplicate section ids")
        raw = "".join(node.text or "" for node in nodes)
        text = "\n".join(b.get("text", "\n".join("\t".join(row) for row in b.get("rows", []))) for c in self.chapters for b in c["blocks"])
        stats = {"sections": len(self.chapters), "chapters": sum(c["kind"] == "chapter" for c in self.chapters), "appendices": sum(c["kind"] == "appendix" for c in self.chapters), "parts": len(self.parts), **self.counts, "blocks": sum(len(c["blocks"]) for c in self.chapters), "images": len(self.assets), "words": len(re.findall(r"\S+", text)), "characters": len(text), "sourceTextNodes": len(nodes), "coveredTextNodes": len(nodes)-len(missing), "sourceTextSha256": hashlib.sha256(raw.encode("utf-8")).hexdigest()}
        return {"parts": self.parts, "chapters": self.chapters, "notes": self.notes(), "statistics": stats}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--edition", default="2026-09-04")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    date.fromisoformat(args.edition)
    source = args.source.resolve(strict=True)
    with ZipFile(source) as archive:
        importer = Importer(archive)
        extracted = importer.run()
    result = {"schemaVersion": 1, "title": "Право на решение", "subtitle": "Инженерное образование как система воспроизводства доверенной способности к решению в эпоху искусственного интеллекта", "edition": args.edition, "publicationStatus": "draft", "source": {"filename": source.name, "format": "docx", "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "importer": "scripts/import-manuscript.py", "textPolicy": "Текст авторской рукописи без редакторского изменения; формулы представлены линейной записью с сохранением исходного OMML."}, **extracted}
    serialized = json.dumps(result, ensure_ascii=False, indent=2)+"\n"
    destination = ROOT/"src/data/book.json"
    if args.check:
        if destination.read_text(encoding="utf-8") != serialized: raise SystemExit("Import differs from src/data/book.json")
        for filename, content in importer.assets.items():
            if (ROOT/"public/book/figures"/filename).read_bytes() != content: raise SystemExit(f"Figure differs: {filename}")
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(serialized, encoding="utf-8", newline="\n")
        figures = ROOT/"public/book/figures"
        figures.mkdir(parents=True, exist_ok=True)
        for filename, content in importer.assets.items(): (figures/filename).write_bytes(content)
    print(json.dumps(result["statistics"], ensure_ascii=True, indent=2))
    print("CHECK OK" if args.check else "IMPORT OK")

if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    main()
