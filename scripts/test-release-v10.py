"""Small technical fixtures only. Never writes a manuscript or accepted release."""
import copy
from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import manuscript_v10 as parser
import release_v10 as release
import public_dossiers_v10
import book_cover_v10
import chapter_docx_v10

FIXTURE = '''# Проверка формата

Технический текст **проверки** и *курсива*.
Вторая строка того же абзаца.

## Таблица

| Показатель | Значение |
| --- | --- |
| Формат | Ячейка[1] |

## Примечания

[1] [Проверяемая ссылка](https://example.org/). Это техническая сноска.

Второй абзац примечания.
'''.encode('utf-8')

def technical_sources(root):
    def put(path, value):
        p=root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(value)
        return release.record(root,path)
    plans=[{'id':i,'title':'Проверка формата','number':n,'part':1 if i.startswith('C') else 0,'part_title':'Техническая fixture'} for n,i in enumerate(release.IDS)]
    for path in release.POLICIES: put(path, release.encode(plans) if path.endswith('chapters.json') else b'Technical fixture, not a book policy.')
    evidence=put('editorial/fixture-review.md',b'Technical test receipt only; not an actual review or release.')
    sources=[{'id':i,**put(f'manuscript/chapters/{i}.md',FIXTURE),'author':'test-writer','independentReviewer':'test-reader','decision':'accepted','unresolvedMaterialIssues':0,'evidence':evidence} for i in release.IDS]
    value={'schemaVersion':1,'editionVersion':'10.0','decision':'accepted-for-release','releaseDate':'2026-09-12','sources':sources,'sourceSetSha256':release.source_set(sources),'policies':[release.record(root,p) for p in release.POLICIES]}
    review={'reviewer':'test-reader','decision':'accepted','sourceSetSha256':value['sourceSetSha256'],'evidence':evidence}
    value['wholeBook']={k:copy.deepcopy(review) for k in release.REVIEW_SCOPES};value['authorApproval']=copy.deepcopy(review)
    put('editorial/acceptance-v10.json',release.encode(value))
    return value

class V10Tests(unittest.TestCase):
    def test_v10_names_note_style_without_changing_text_or_links(self):
        title, blocks, notes, _ = parser.parse(FIXTURE, 'chapter-01')
        # The legacy verifier needs table anchors flattened for its counter.
        chapter = {'id': 'note-style-test', 'title': title, 'version': '10.0', 'blocks': [b for b in blocks if b['type'] != 'table']}
        chapter['blocks'].append({'type': 'paragraph', 'text': '[1]', 'runs': [{'text': '[1]', 'noteId': notes[0]['id']}]})
        before_raw = chapter_docx_v10.legacy.build(chapter, notes)
        after_raw = chapter_docx_v10.build(chapter, notes)
        with ZipFile(BytesIO(before_raw)) as before, ZipFile(BytesIO(after_raw)) as after:
            w = '{' + book_cover_v10.W + '}'
            for name in before.namelist():
                if name != 'word/styles.xml': self.assertEqual(after.read(name), before.read(name))
            original = ET.fromstring(before.read('word/styles.xml'))
            updated = ET.fromstring(after.read('word/styles.xml'))
            note = next(n for n in updated if n.get(w + 'styleId') == 'Note')
            self.assertEqual(note.find(w + 'name').get(w + 'val'), 'Note')
            note.remove(note.find(w + 'name'))
            self.assertEqual(ET.tostring(updated), ET.tostring(original))

    def test_pdf_footer_does_not_remove_body_numbers_or_extra_text(self):
        from pypdf import PdfWriter
        from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
        writer = PdfWriter()
        page = writer.add_blank_page(width=595.3, height=841.9)
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): font})})
        content = DecodedStreamObject()
        raw = b'/Artifact BMC q BT /F1 12 Tf 294.45 41.089 Td (2) Tj ET Q EMC\n/P BMC q BT /F1 12 Tf 68 720 Td (2) Tj 0 -20 Td (Body X) Tj ET Q EMC'
        content.set_data(raw)
        page[NameObject('/Contents')] = content
        body = release.pdf_body_page(page, 2)
        release.verify_pdf_visible_text([body], ['2', 'Body X'])
        with self.assertRaises(ValueError): release.verify_pdf_visible_text([body], ['2', 'Body'])
        self.assertEqual(page.get_contents().get_data(), raw)
        # Matching number and geometry alone cannot authorize removal.
        content.set_data(raw.replace(b'/Artifact', b'/P', 1))
        with self.assertRaises(ValueError): release.pdf_body_page(page, 2)

    def test_explicit_breaks_only_on_26_section_headings(self):
        _, fixture_blocks, notes, _ = parser.parse(FIXTURE, 'chapter-01')
        blocks = []
        for ident in release.IDS:
            blocks.append({'id': ident, 'type': 'heading', 'level': 2, 'text': 'Раздел ' + ident, 'pageBreakBefore': True})
            blocks.extend(copy.deepcopy(fixture_blocks))
            # Same text/style as a section heading must not select this internal heading.
            blocks.append({'id': ident + '-inner', 'type': 'heading', 'level': 2, 'text': 'Раздел ' + ident})
            blocks.append({'id': ident + '-inner2', 'type': 'heading', 'level': 3, 'text': 'Внутренний подзаголовок'})
        chapter = {'id': 'technical-26-sections', 'title': 'Только техническая проверка', 'version': '10.0', 'blocks': blocks}
        plain = copy.deepcopy(chapter)
        for block in plain['blocks']: block.pop('pageBreakBefore', None)
        before_raw = chapter_docx_v10.build(plain, notes)
        after_raw = chapter_docx_v10.build(chapter, notes)
        with ZipFile(BytesIO(before_raw)) as before, ZipFile(BytesIO(after_raw)) as after:
            w = '{' + book_cover_v10.W + '}'
            original = ET.fromstring(before.read('word/document.xml'))
            updated = ET.fromstring(after.read('word/document.xml'))
            selected = [p for p in updated.iter(w + 'p') if p.find(w + 'pPr/' + w + 'pageBreakBefore') is not None]
            self.assertEqual([''.join(t.text or '' for t in p.iter(w + 't')) for p in selected], ['Раздел ' + ident for ident in release.IDS])
            for p in selected:
                props = p.find(w + 'pPr'); props.remove(props.find(w + 'pageBreakBefore'))
            self.assertEqual(ET.tostring(updated), ET.tostring(original))
            for name in before.namelist():
                if name != 'word/document.xml': self.assertEqual(after.read(name), before.read(name))

    def test_full_markdown_authors_and_sources_preserved(self):
        book = {'title': 'Техническая книга', 'subtitle': 'Технический подзаголовок'}
        second = '# Второй раздел\n\nАбзац[1].\n\n## Примечания\n\n[1] Другая локальная сноска.\n'.encode('utf-8')
        expected_body = FIXTURE.decode().strip() + '\n\n' + second.decode().strip() + '\n'
        rendered = release.whole_markdown(book, [FIXTURE, second])
        prefix = '# Техническая книга\n\nТехнический подзаголовок\n\n' + release.AUTHORS + '\n\n'
        self.assertEqual(rendered, prefix + expected_body)
        self.assertEqual(rendered.count(release.AUTHORS), 1)

    def test_cover_preserves_png_and_original_document(self):
        title, blocks, notes, _ = parser.parse(FIXTURE, 'chapter-01')
        chapter = {'id': 'chapter-01', 'title': title, 'version': '10.0', 'blocks': blocks}
        raw = chapter_docx_v10.build(chapter, notes)
        png = (release.ROOT / release.COVER).read_bytes()
        covered = book_cover_v10.prepend(raw, png)
        self.assertEqual(covered, book_cover_v10.prepend(raw, png))
        with ZipFile(BytesIO(raw)) as before, ZipFile(BytesIO(covered)) as after:
            self.assertEqual(after.read(book_cover_v10.MEDIA), png)
            for name in before.namelist():
                if name not in ['word/document.xml', 'word/_rels/document.xml.rels', '[Content_Types].xml']:
                    self.assertEqual(after.read(name), before.read(name))
            for name, namespace, tag in [('[Content_Types].xml', book_cover_v10.C, 'Types'), ('word/_rels/document.xml.rels', book_cover_v10.P, 'Relationships')]:
                xml = after.read(name)
                self.assertEqual(ET.fromstring(xml).tag, '{' + namespace + '}' + tag)
                self.assertIn(('<' + tag + ' xmlns="' + namespace + '"').encode(), xml)
            original = ET.fromstring(before.read('word/document.xml'))
            updated = ET.fromstring(after.read('word/document.xml'))
            w = '{' + book_cover_v10.W + '}'
            body = updated.find(w + 'body')
            self.assertIsNotNone(body[0].find('.//' + w + 'drawing'))
            body.remove(body[0])
            props = body[0].find(w + 'pPr')
            props.remove(props.find(w + 'pageBreakBefore'))
            section = body.find(w + 'sectPr')
            section.remove(section.find(w + 'titlePg'))
            # Includes runs, formatting, hyperlinks, table cells and note bookmarks.
            self.assertEqual(ET.tostring(updated), ET.tostring(original))
        with self.assertRaises(ValueError):
            book_cover_v10.prepend(covered, png)
    def test_table_only_note_binds(self):
        _,blocks,notes,_=parser.parse(FIXTURE,'chapter-01','Проверка формата')
        table=next(b for b in blocks if b['type']=='table')
        self.assertEqual(parser.runs(table)[-1]['noteId'],notes[0]['id'])
        self.assertEqual(len(notes[0]['blocks']),2)
    def test_changed_bytes_get_new_ids(self):
        one=parser.parse(FIXTURE,'chapter-01')[1][0]['id']
        two=parser.parse(FIXTURE+b'\n','chapter-01')[1][0]['id']
        self.assertNotEqual(one,two)
        self.assertTrue(one.startswith('manuscript-v10-chapter-01-'))
    def test_reject_undefined_and_unused_notes(self):
        for raw in [FIXTURE.replace(b'[1] |',b'[2] |'),FIXTURE.replace(b'\x5b1\x5d |',b' |')]:
            with self.assertRaises(ValueError):parser.parse(raw,'chapter-01')
    def test_reject_unsupported_and_private_links(self):
        for text in ['# T\n\n<div>Text</div>','# T\n\n![image](https://example.org/a.png)','# T\n\nText[^1]','# T\n\n[link](file:///C:/private)']:
            with self.assertRaises(ValueError):parser.parse(text.encode(),'chapter-01')
    def test_reject_wrong_title_or_number(self):
        with self.assertRaises(ValueError):parser.parse(FIXTURE,'chapter-01','Wrong')
        with self.assertRaises(ValueError):parser.parse('# Глава 2. Тест\n\nАбзац'.encode(),'chapter-01','Тест')
    def test_missing_acceptance_fails_before_outputs(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):release.prepare(Path(d),release.ROOT/'.release-staging/test-must-not-exist','editorial/acceptance-v10.json')
            self.assertFalse((release.ROOT/'.release-staging/test-must-not-exist').exists())
    def test_exact_26_files_and_review_hashes(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);value=technical_sources(root)
            accepted,plans,_=release.acceptance(root)
            self.assertEqual(len(release.projection(root,accepted,plans)['chapters']),26)
            (root/'manuscript/chapters/C24.md').write_bytes(FIXTURE+b'changed')
            with self.assertRaises(ValueError):release.acceptance(root)
            (root/'manuscript/chapters/C24.md').write_bytes(FIXTURE)
            value['sources'][0]['independentReviewer']='test-writer'
            (root/'editorial/acceptance-v10.json').write_bytes(release.encode(value))
            with self.assertRaises(ValueError):release.acceptance(root)
    def test_partial_and_stale_whole_book_review_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);value=technical_sources(root)
            for mutation in ['partial','review']:
                bad=copy.deepcopy(value)
                if mutation=='partial':bad['sources'].pop()
                else:bad['wholeBook']['continuousReading']['sourceSetSha256']='0'*64
                (root/'editorial/acceptance-v10.json').write_bytes(release.encode(bad))
                with self.assertRaises(ValueError):release.acceptance(root)
    def test_v9_archive_is_exact_and_available(self):
        for item in release.read(release.ROOT/'docs/publishing/v10/archive-v9.json')['files']:release.checked(release.ROOT,item)
        archive=release.read(release.ROOT/release.ARCHIVE)
        self.assertEqual(archive['releaseId'],'literary-manuscript-v9.0-26472e4aa686')
    def test_public_dossiers_use_explicit_allowlist(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);folder=root/'public/research-v10';folder.mkdir(parents=True)
            items=[]
            for ident in ['INDEX','M01','M02','M03','M04']:
                name='index' if ident=='INDEX' else ident
                (folder/(name+'.md')).write_bytes(FIXTURE)
                items.append({'id':ident,**release.record(root,'public/research-v10/'+name+'.md')})
            (root/'models').mkdir();(root/'models/allowed.csv').write_bytes(b'year,value\n0,1\n')
            (root/'models/private.csv').write_bytes(b'not selected')
            package={'decision':'accepted','reviewer':'technical-test-reader','texts':items,'downloads':[{'modelId':'M01','name':'allowed.csv','label':'Technical CSV',**release.record(root,'models/allowed.csv')}]}
            (folder/'manifest.json').write_bytes(release.encode(package))
            _,data,outputs=public_dossiers_v10.collect(root,release.checked,release.require)
            self.assertEqual([m['id'] for m in data['models']],['M01','M02','M03','M04'])
            self.assertEqual(len(outputs),6)
            self.assertFalse(any('private' in p for p in outputs))
            package['downloads'][0]['path']='book-memory/private.csv'
            (folder/'manifest.json').write_bytes(release.encode(package))
            with self.assertRaises(ValueError):public_dossiers_v10.collect(root,release.checked,release.require)
    @unittest.skipUnless(Path(r'C:\Program Files\LibreOffice\program\soffice.exe').is_file(), 'Local PDF converter unavailable; PDF artifacts are verified by hash in CI')
    def test_pdf_paragraph_across_page_and_numeric_body(self):
        from pypdf import PdfReader
        paragraph = ' '.join(f'Фрагмент {i}: проверяем непрерывное чтение длинного абзаца через границу страницы без потери текста.' for i in range(1, 86))
        book = {'title': 'Технический разрыв страницы', 'subtitle': 'Не рукопись', 'chapters': [{'id': 'chapter-01', 'title': 'Переход через страницу', 'blocks': [{'id': 'numeric-body', 'type': 'paragraph', 'text': '3'}, {'id': 'long-body', 'type': 'paragraph', 'text': paragraph}]}], 'notes': []}
        with tempfile.TemporaryDirectory() as d:
            checks = release.documents(book, Path(d))
            self.assertTrue(checks['pdfVisibleTextInOrder'])
            self.assertGreater(checks['pdfPages'], 3)
            self.assertEqual(checks['pdfSectionStartPages'], [3])
            pages = PdfReader(Path(d) / 'right-to-decide-v10.0.pdf').pages
            self.assertIn('Фрагмент 1:', pages[2].extract_text())
            self.assertNotIn('Фрагмент 85:', pages[2].extract_text())
            self.assertIn('Фрагмент 85:', pages[-1].extract_text())

    @unittest.skipUnless(Path(r'C:\Program Files\LibreOffice\program\soffice.exe').is_file(), 'Local PDF converter unavailable; PDF artifacts are verified by hash in CI')
    def test_technical_docx_pdf_export(self):
        title,blocks,notes,heading=parser.parse(FIXTURE,'chapter-01')
        book={'title':'Техническая проверка формата — не рукопись','subtitle':'Один тестовый фрагмент','chapters':[{'id':'chapter-01','title':title,'blocks':blocks}, {'id':'chapter-02','title':'Второй технический раздел','blocks':[{'id':'inner','type':'heading','level':3,'text':'Внутренний заголовок'}, {'id':'second-body','type':'paragraph','text':'Сохранённый текст второго технического раздела.'}]}],'notes':notes}
        with tempfile.TemporaryDirectory() as d:
            checks=release.documents(book,Path(d))
            self.assertTrue(checks['docxVisibleTextExact']);self.assertTrue(checks['pdfVisibleTextInOrder'])
            self.assertGreaterEqual(checks['pdfPages'],2)
            self.assertTrue(checks['pdfCoverFirstPageUnnumbered'])
            self.assertTrue(checks['pdfTitleOnSecondPage'])
            self.assertTrue(checks['docxSectionStartsNewPage'])
            self.assertEqual(checks['pdfSectionStartPages'], [3, 4])
            from pypdf import PdfReader
            pages = PdfReader(Path(d) / 'right-to-decide-v10.0.pdf').pages
            urls = [str(annotation.get_object().get('/A', {}).get('/URI', '')) for page in pages for annotation in page.get('/Annots', [])]
            self.assertIn('https://example.org/', urls)

if __name__=='__main__':unittest.main(verbosity=2)
