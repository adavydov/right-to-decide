"""Add the supplied cover to the whole-book OOXML without changing body text."""
from io import BytesIO
import struct
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZipInfo, ZIP_STORED

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P = 'http://schemas.openxmlformats.org/package/2006/relationships'
C = 'http://schemas.openxmlformats.org/package/2006/content-types'
WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture'
MEDIA = 'word/media/book-cover-v10.png'

def _opc_xml(root, namespace):
    """Keep the default OPC namespace expected by the LibreOffice importer.

    ElementTree otherwise emits ns0:Types/ns0:Relationships. Although those
    prefixes preserve XML names, this converter rejects the resulting package.
    Local trees avoid changing ElementTree's global namespace registry, which
    is also used by the unchanged legacy renderer.
    """
    prefix = '{' + namespace + '}'
    for element in root.iter():
        if not element.tag.startswith(prefix):
            raise ValueError('Unexpected namespace in cover OPC part')
        element.tag = element.tag[len(prefix):]
    root.set('xmlns', namespace)
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)

def prepend(raw, png):
    if not png.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Cover must be the supplied PNG')
    width, height = struct.unpack('>II', png[16:24])
    if not width or not height:
        raise ValueError('Invalid PNG dimensions')
    with ZipFile(BytesIO(raw)) as archive:
        files = {name: archive.read(name) for name in archive.namelist()}
    if MEDIA in files:
        raise ValueError('Cover already present')
    root = ET.fromstring(files['word/document.xml'])
    body = root.find('{'+W+'}body')
    section = body.find('{'+W+'}sectPr')
    page, margins = section.find('{'+W+'}pgSz'), section.find('{'+W+'}pgMar')
    available_w = int(page.get('{'+W+'}w')) - int(margins.get('{'+W+'}left')) - int(margins.get('{'+W+'}right'))
    available_h = int(page.get('{'+W+'}h')) - int(margins.get('{'+W+'}top')) - int(margins.get('{'+W+'}bottom')) - 240
    scale = min(available_w * 635 / width, available_h * 635 / height)
    cx, cy = int(width * scale), int(height * scale)
    drawing = f'''<w:p xmlns:w="{W}" xmlns:r="{R}" xmlns:wp="{WP}" xmlns:a="{A}" xmlns:pic="{PIC}">
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
      <w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="{cx}" cy="{cy}"/><wp:docPr id="10000" name="Book cover" descr="Обложка книги Право на решение"/>
        <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
        <a:graphic><a:graphicData uri="{PIC}"><pic:pic>
          <pic:nvPicPr><pic:cNvPr id="10000" name="book-cover-v10.png"/><pic:cNvPicPr/></pic:nvPicPr>
          <pic:blipFill><a:blip r:embed="v10Cover"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
          <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
        </pic:pic></a:graphicData></a:graphic>
      </wp:inline></w:drawing></w:r></w:p>'''
    first = body.find('{'+W+'}p')
    properties = first.find('{'+W+'}pPr')
    if properties is None:
        properties = ET.Element('{'+W+'}pPr'); first.insert(0, properties)
    ET.SubElement(properties, '{'+W+'}pageBreakBefore')
    body.insert(0, ET.fromstring(drawing))
    ET.SubElement(section, '{'+W+'}titlePg')
    files['word/document.xml'] = ET.tostring(root, encoding='utf-8', xml_declaration=True)
    rels = ET.fromstring(files['word/_rels/document.xml.rels'])
    ET.SubElement(rels, '{'+P+'}Relationship', Id='v10Cover', Type=R+'/image', Target='media/book-cover-v10.png')
    files['word/_rels/document.xml.rels'] = _opc_xml(rels, P)
    types = ET.fromstring(files['[Content_Types].xml'])
    if not any(x.get('Extension') == 'png' for x in types):
        ET.SubElement(types, '{'+C+'}Default', Extension='png', ContentType='image/png')
    files['[Content_Types].xml'] = _opc_xml(types, C)
    files[MEDIA] = png
    output = BytesIO()
    with ZipFile(output, 'w') as archive:
        for name, data in files.items():
            info = ZipInfo(name, (2026, 9, 12, 0, 0, 0)); info.compress_type = ZIP_STORED
            archive.writestr(info, data)
    return output.getvalue()
