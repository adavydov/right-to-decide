"""Deterministic OOXML chapter export using only Python's standard library.

The document and website use the same parsed blocks. Every generated package is
opened again to compare all paragraph text and hyperlink targets before release.
"""
from __future__ import annotations

from io import BytesIO
from xml.etree import ElementTree as ET
from zipfile import ZIP_STORED, ZipFile, ZipInfo

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
P = "http://schemas.openxmlformats.org/package/2006/relationships"
ET.register_namespace("w", W)
ET.register_namespace("r", R)


def el(parent, tag, attrs=None, text=None):
    result = ET.SubElement(parent, "{" + W + "}" + tag, {"{" + W + "}" + key: str(value) for key, value in (attrs or {}).items()})
    result.text = text
    return result


def xml(element):
    return ET.tostring(element, encoding="utf-8", xml_declaration=True)


def document_lines(chapter):
    return [chapter["title"], "Право на решение · версия " + chapter["version"],
            *[(b.get("list", {}).get("marker", "") + " " if b.get("list") else "") + b["text"] for b in chapter["blocks"]]]


def build(chapter):
    document = ET.Element("{" + W + "}document")
    body = el(document, "body")
    relationships = ET.Element("Relationships", xmlns=P)
    for ident, kind, target in [("styles", "styles", "styles.xml"), ("footer", "footer", "footer1.xml")]:
        ET.SubElement(relationships, "Relationship", Id=ident, Type=R + "/" + kind, Target=target)
    links = {}

    def paragraph(text, style, runs=None, listed=False):
        p = el(body, "p")
        props = el(p, "pPr")
        el(props, "pStyle", {"val": style})
        if listed:
            el(props, "ind", {"left": 360, "hanging": 360})
        for run in runs or [{"text": text}]:
            parent = p
            if run.get("href"):
                url = run["href"]
                if url not in links:
                    links[url] = "link" + str(len(links) + 1)
                    ET.SubElement(relationships, "Relationship", Id=links[url], Type=R + "/hyperlink", Target=url, TargetMode="External")
                parent = el(p, "hyperlink", {"history": 1})
                parent.set("{" + R + "}id", links[url])
            r = el(parent, "r")
            properties = el(r, "rPr")
            if run.get("strong"):
                el(properties, "b")
            if run.get("emphasis"):
                el(properties, "i")
            if run.get("code"):
                el(properties, "rFonts", {"ascii": "Consolas", "hAnsi": "Consolas"})
            if run.get("href"):
                el(properties, "rStyle", {"val": "Hyperlink"})
            for index, line in enumerate(run["text"].split("\n")):
                if index:
                    el(r, "br")
                node = el(r, "t", text=line)
                node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

    paragraph(chapter["title"], "Title")
    paragraph("Право на решение · версия " + chapter["version"], "Subtitle")
    for block in chapter["blocks"]:
        if block["type"] not in {"heading", "paragraph"}:
            raise ValueError("DOCX export needs an explicit renderer for " + block["type"])
        runs = block.get("runs", [{"text": block["text"]}])
        if block.get("list"):
            runs = [{"text": block["list"]["marker"] + " "}, *runs]
        style = ("Heading" + str(min(block.get("level", 2), 3) - 1) if block["type"] == "heading"
                 else "Separator" if block.get("role") == "separator" else "Normal")
        paragraph(block["text"], style, runs, bool(block.get("list")))
    section = el(body, "sectPr")
    footer_ref = el(section, "footerReference", {"type": "default"})
    footer_ref.set("{" + R + "}id", "footer")
    el(section, "pgSz", {"w": 11906, "h": 16838})
    el(section, "pgMar", {"top": 1276, "right": 1361, "bottom": 1276, "left": 1361, "header": 567, "footer": 567, "gutter": 0})

    styles = ET.Element("{" + W + "}styles")
    defaults = el(styles, "docDefaults")
    run_defaults = el(el(defaults, "rPrDefault"), "rPr")
    el(run_defaults, "rFonts", {"ascii": "Georgia", "hAnsi": "Georgia", "cs": "Georgia"})
    el(run_defaults, "sz", {"val": 24})
    el(run_defaults, "lang", {"val": "ru-RU"})
    for name, size, before, after, bold in [("Normal", 24, 0, 120, False), ("Title", 40, 0, 240, True),
                                             ("Subtitle", 20, 0, 480, False), ("Heading1", 30, 360, 180, True),
                                             ("Heading2", 26, 280, 150, True), ("Separator", 24, 150, 200, False)]:
        style = el(styles, "style", {"type": "paragraph", "styleId": name})
        if name == "Normal":
            style.set("{" + W + "}default", "1")
        el(style, "name", {"val": name})
        props = el(style, "pPr")
        el(props, "spacing", {"before": before, "after": after, "line": 312, "lineRule": "auto"})
        el(props, "widowControl")
        if name in {"Title", "Subtitle", "Heading1", "Heading2"}:
            el(props, "keepNext")
        if name.startswith("Heading"):
            el(props, "outlineLvl", {"val": int(name[-1]) - 1})
        if name == "Separator":
            el(props, "jc", {"val": "center"})
        rp = el(style, "rPr")
        el(rp, "sz", {"val": size})
        if bold:
            el(rp, "b")
        if name == "Subtitle":
            el(rp, "color", {"val": "666666"})
    hyperlink = el(styles, "style", {"type": "character", "styleId": "Hyperlink"})
    el(hyperlink, "name", {"val": "Hyperlink"})
    rp = el(hyperlink, "rPr")
    el(rp, "color", {"val": "315D82"})
    el(rp, "u", {"val": "single"})

    footer = ET.Element("{" + W + "}ftr")
    p = el(footer, "p")
    el(el(p, "pPr"), "jc", {"val": "center"})
    field = el(p, "fldSimple", {"instr": "PAGE"})
    el(el(field, "r"), "t", text="1")
    content_types = b'''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'''
    package_rels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="' + P + '"><Relationship Id="document" Type="' + R + '/officeDocument" Target="word/document.xml"/></Relationships>').encode()
    output = BytesIO()
    # Stored entries avoid byte drift between Windows/Linux zlib versions.
    with ZipFile(output, "w", compression=ZIP_STORED) as package:
        for name, raw in [("[Content_Types].xml", content_types), ("_rels/.rels", package_rels),
                          ("word/document.xml", xml(document)), ("word/styles.xml", xml(styles)),
                          ("word/footer1.xml", xml(footer)), ("word/_rels/document.xml.rels", xml(relationships))]:
            info = ZipInfo(name, (2026, 9, 6, 0, 0, 0))
            info.create_system = 3
            info.compress_type = ZIP_STORED
            info.external_attr = 0o644 << 16
            package.writestr(info, raw)
    raw = output.getvalue()
    verify(raw, chapter)
    return raw


def verify(raw, chapter):
    with ZipFile(BytesIO(raw)) as package:
        if package.testzip():
            raise ValueError("Corrupt DOCX package")
        document = ET.fromstring(package.read("word/document.xml"))
        lines = []
        for paragraph in document.findall(".//{" + W + "}body/{" + W + "}p"):
            lines.append("".join(node.text or "" if node.tag == "{" + W + "}t" else "\n"
                                 for node in paragraph.iter() if node.tag in {"{" + W + "}t", "{" + W + "}br"}))
        if lines != document_lines(chapter):
            raise ValueError("DOCX text/order differs from the reader: " + chapter["id"])
        relationships = ET.fromstring(package.read("word/_rels/document.xml.rels"))
        actual = {r.attrib["Target"] for r in relationships if r.attrib.get("Type") == R + "/hyperlink"}
        expected = {r["href"] for b in chapter["blocks"] for r in b.get("runs", []) if r.get("href")}
        if actual != expected:
            raise ValueError("DOCX source links differ: " + chapter["id"])
