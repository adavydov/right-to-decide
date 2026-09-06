"""Deterministic v7 OOXML with source notes, internal links and tables."""
from __future__ import annotations
from io import BytesIO
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZipInfo, ZIP_STORED
import chapter_docx as shared

W, R, P = shared.W, shared.R, shared.P
el, xml = shared.el, shared.xml


def document_lines(chapter, notes):
    lines = [chapter["title"], "Право на решение · версия " + chapter["version"]]
    for block in chapter["blocks"]:
        if block["type"] == "table":
            lines.extend(cell for row in block["rows"] for cell in row)
        else:
            lines.append((block.get("list", {}).get("marker", "") + " " if block.get("list") else "") + block["text"])
    if notes:
        lines.append(chapter.get("notesHeading", "Примечания"))
        for note in notes:
            for index, block in enumerate(note["blocks"]):
                lines.append((str(note["number"]) + ". " if index == 0 else "") + block["text"])
    return lines


def build(chapter, notes):
    document = ET.Element("{" + W + "}document")
    body = el(document, "body")
    relationships = ET.Element("Relationships", xmlns=P)
    for ident, kind, target in [("styles", "styles", "styles.xml"), ("footer", "footer", "footer1.xml")]:
        ET.SubElement(relationships, "Relationship", Id=ident, Type=R + "/" + kind, Target=target)
    links, bookmarks = {}, {note["id"]: "Note" + str(index + 1) for index, note in enumerate(notes)}

    def paragraph(parent, text, style="Normal", runs=None, bookmark=None):
        p = el(parent, "p")
        el(el(p, "pPr"), "pStyle", {"val": style})
        if bookmark:
            el(p, "bookmarkStart", {"id": bookmark[1], "name": bookmark[0]})
        for run in runs or [{"text": text}]:
            container = p
            if run.get("noteId"):
                container = el(p, "hyperlink", {"anchor": bookmarks[run["noteId"]], "history": 1})
            elif run.get("href"):
                url = run["href"]
                if url not in links:
                    links[url] = "link" + str(len(links) + 1)
                    ET.SubElement(relationships, "Relationship", Id=links[url], Type=R + "/hyperlink", Target=url, TargetMode="External")
                container = el(p, "hyperlink", {"history": 1})
                container.set("{" + R + "}id", links[url])
            r = el(container, "r")
            props = el(r, "rPr")
            if run.get("strong"):
                el(props, "b")
            if run.get("emphasis"):
                el(props, "i")
            if run.get("code"):
                el(props, "rFonts", {"ascii": "Consolas", "hAnsi": "Consolas"})
            if run.get("href") or run.get("noteId"):
                el(props, "rStyle", {"val": "Hyperlink"})
            for index, line in enumerate(run["text"].split("\n")):
                if index:
                    el(r, "br")
                node = el(r, "t", text=line)
                node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        if bookmark:
            el(p, "bookmarkEnd", {"id": bookmark[1]})

    paragraph(body, chapter["title"], "Title")
    paragraph(body, "Право на решение · версия " + chapter["version"], "Subtitle")
    for block in chapter["blocks"]:
        if block["type"] == "table":
            table = el(body, "tbl")
            props = el(table, "tblPr")
            el(props, "tblW", {"w": 0, "type": "auto"})
            borders = el(props, "tblBorders")
            for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
                el(borders, edge, {"val": "single", "sz": 4, "color": "CCCCCC"})
            for row_index, row in enumerate(block["rows"]):
                tr = el(table, "tr")
                tr_props = el(tr, "trPr")
                el(tr_props, "cantSplit")
                if row_index == 0:
                    el(tr_props, "tblHeader")
                for cell_index, cell in enumerate(row):
                    runs = block.get("cellRuns", [])[row_index][cell_index] if block.get("cellRuns") else [{"text": cell}]
                    if row_index == 0:
                        runs = [{**r, "strong": True} for r in runs]
                    paragraph(el(tr, "tc"), cell, runs=runs)
            continue
        runs = block.get("runs", [{"text": block["text"]}])
        if block.get("list"):
            runs = [{"text": block["list"]["marker"] + " "}, *runs]
        style = "Heading" + str(min(block.get("level", 2), 3) - 1) if block["type"] == "heading" else "Normal"
        paragraph(body, block["text"], style, runs)
    if notes:
        paragraph(body, chapter.get("notesHeading", "Примечания"), "Heading1")
        for note_index, note in enumerate(notes, 1):
            for index, block in enumerate(note["blocks"]):
                runs = block.get("runs", [{"text": block["text"]}])
                if index == 0:
                    runs = [{"text": str(note["number"]) + ". "}, *runs]
                paragraph(body, block["text"], "Note", runs,
                          (bookmarks[note["id"]], note_index) if index == 0 else None)
    section = el(body, "sectPr")
    footer_ref = el(section, "footerReference", {"type": "default"})
    footer_ref.set("{" + R + "}id", "footer")
    el(section, "pgSz", {"w": 11906, "h": 16838})
    el(section, "pgMar", {"top": 1276, "right": 1361, "bottom": 1276, "left": 1361, "header": 567, "footer": 567, "gutter": 0})
    # Reuse the proven v6 styles, footer and OPC declarations without changing it.
    seed = {"id": "styles", "title": "", "version": "7.0", "blocks": []}
    with ZipFile(BytesIO(shared.build(seed))) as base:
        entries = {name: base.read(name) for name in base.namelist()}
    styles = ET.fromstring(entries["word/styles.xml"])
    note_style = el(styles, "style", {"type": "paragraph", "styleId": "Note"})
    el(note_style, "basedOn", {"val": "Normal"})
    el(el(note_style, "rPr"), "sz", {"val": 20})
    entries.update({"word/document.xml": xml(document), "word/styles.xml": xml(styles),
                    "word/_rels/document.xml.rels": xml(relationships)})
    output = BytesIO()
    with ZipFile(output, "w", compression=ZIP_STORED) as package:
        for name, raw in entries.items():
            info = ZipInfo(name, (2026, 9, 6, 0, 0, 0))
            info.create_system = 3
            info.compress_type = ZIP_STORED
            info.external_attr = 0o644 << 16
            package.writestr(info, raw)
    raw = output.getvalue()
    verify(raw, chapter, notes)
    return raw


def verify(raw, chapter, notes):
    with ZipFile(BytesIO(raw)) as package:
        if package.testzip():
            raise ValueError("Corrupt chapter DOCX")
        document = ET.fromstring(package.read("word/document.xml"))
        lines = ["".join(node.text or "" if node.tag == "{" + W + "}t" else "\n"
                         for node in p.iter() if node.tag in {"{" + W + "}t", "{" + W + "}br"})
                 for p in document.findall(".//{" + W + "}body//{" + W + "}p")]
        if lines != document_lines(chapter, notes):
            raise ValueError(chapter["id"] + ": DOCX text/table/note order differs")
        bookmarks = {node.get("{" + W + "}name") for node in document.findall(".//{" + W + "}bookmarkStart")}
        anchors = [node.get("{" + W + "}anchor") for node in document.findall(".//{" + W + "}hyperlink") if node.get("{" + W + "}anchor")]
        expected_refs = sum(bool(r.get("noteId")) for b in chapter["blocks"] for r in b.get("runs", []))
        if len(anchors) != expected_refs or any(anchor not in bookmarks for anchor in anchors) or len(bookmarks) != len(notes):
            raise ValueError(chapter["id"] + ": DOCX note links differ")
        relationships = ET.fromstring(package.read("word/_rels/document.xml.rels"))
        actual = {r.attrib["Target"] for r in relationships if r.attrib.get("Type") == R + "/hyperlink"}
        all_blocks = chapter["blocks"] + [b for n in notes for b in n["blocks"]]
        expected = {r["href"] for b in all_blocks for r in b.get("runs", []) if r.get("href")}
        expected |= {r["href"] for b in all_blocks for row in b.get("cellRuns", []) for cell in row for r in cell if r.get("href")}
        if actual != expected:
            raise ValueError(chapter["id"] + ": DOCX source links differ")