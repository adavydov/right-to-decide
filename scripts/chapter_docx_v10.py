"""Reuse v7 rendering; verify table notes and apply explicit v10 section breaks."""
import types
from io import BytesIO
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import chapter_docx_v7 as legacy
def verify(raw, chapter, notes):
    # The legacy visible-text verifier reads table rows. Supply the same cell
    # runs to its separate anchor counter without changing the rendered XML.
    projected = {**chapter, 'blocks': [{**b, 'runs': [r for row in b['cellRuns'] for cell in row for r in cell]} if b['type'] == 'table' else b for b in chapter['blocks']]}
    legacy.verify(raw, projected, notes)
_globals = {**legacy.build.__globals__, 'verify': verify}
_render = types.FunctionType(legacy.build.__code__, _globals, 'build')

def build(chapter, notes):
    raw = _render(chapter, notes)
    starts = [(index + 2, block) for index, block in enumerate(chapter['blocks']) if block.get('pageBreakBefore')]
    if not starts and not notes:
        return raw
    with ZipFile(BytesIO(raw)) as archive:
        entries = [(info, archive.read(info.filename)) for info in archive.infolist()]
    document = ET.fromstring(dict((info.filename, data) for info, data in entries)['word/document.xml'])
    w = '{' + legacy.W + '}'
    body = document.find(w + 'body')
    # The renderer emits title/subtitle, then one top-level element per block
    # (a table is one element too). Notes follow the blocks. Select by position,
    # not heading style or text: internal headings and notes may use the same style.
    for index, block in starts:
        paragraph = body[index]
        if block['type'] != 'heading' or paragraph.tag != w + 'p':
            raise ValueError('Section page break must address a heading paragraph')
        ET.SubElement(paragraph.find(w + 'pPr'), w + 'pageBreakBefore')
    styles = ET.fromstring(dict((info.filename, data) for info, data in entries)['word/styles.xml'])
    if notes:
        # LibreOffice's importer appends a visible X after external hyperlinks
        # in the legacy unnamed Note style. Give that existing style its name;
        # retain its formatting, every text run, URL and bookmark unchanged.
        note_style = next(node for node in styles if node.get(w + 'styleId') == 'Note')
        if note_style.find(w + 'name') is None:
            note_style.insert(0, ET.Element(w + 'name', {w + 'val': 'Note'}))
    output = BytesIO()
    with ZipFile(output, 'w') as archive:
        for info, data in entries:
            if info.filename == 'word/document.xml' and starts:
                data = ET.tostring(document, encoding='utf-8', xml_declaration=True)
            elif info.filename == 'word/styles.xml' and notes:
                data = ET.tostring(styles, encoding='utf-8', xml_declaration=True)
            archive.writestr(info, data)
    return output.getvalue()
