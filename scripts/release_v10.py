"""Prepare/check/install a real accepted v10 corpus. No network or publication."""
from __future__ import annotations
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import tempfile
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import manuscript_v10
import chapter_docx_v7
import chapter_docx_v10
import public_dossiers_v10
import public_library_v10
import public_editorial_v10
import book_cover_v10

ROOT = Path(__file__).resolve().parents[1]
IDS = ['P00'] + [f'C{i:02d}' for i in range(1, 25)] + ['E00']
REVIEW_SCOPES = ['continuousReading', 'factualReview', 'alternativesReview', 'continuityReview', 'repetitionReview']
POLICIES = ['CONSTITUTION.md', 'planning/chapters.json', 'editorial/QUALITY_GATES.md']
ARCHIVE = 'src/data/edition-v9.json'
MANIFEST = 'manuscript/v10/release-manifest.json'
COVER = 'public/images/book-cover-v10.png'
AUTHORS = 'А. М. Давыдов · А. А. Давыдов · Е. А. Давыдов'
GENERATOR_FILES = ['scripts/release_v10.py', 'scripts/manuscript_v10.py', 'scripts/chapter_docx_v10.py', 'scripts/chapter_docx_v7.py', 'scripts/chapter_docx.py', 'scripts/manuscript_markdown.py', 'manuscript/2026-09-06-corpus-rebuild/technical/manuscript_v9.py', 'manuscript/2026-09-05-rebuild/build_reading_documents.py']
def encode(value): return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
def sha(raw): return hashlib.sha256(raw).hexdigest()
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def require(condition, message):
    if not condition: raise ValueError(message)
def local(root, relative):
    require(isinstance(relative, str) and '\\' not in relative and not Path(relative).is_absolute() and all(p not in ['', '.', '..'] for p in relative.split('/')), 'Unsafe relative path')
    target = (root / relative).resolve()
    require(target.is_relative_to(root.resolve()), 'Path escapes selected root')
    return target
def record(root, relative):
    raw = local(root, relative).read_bytes()
    return {'path': relative, 'sha256': sha(raw), 'bytes': len(raw)}
def checked(root, item):
    raw = local(root, item['path']).read_bytes()
    require(sha(raw) == item['sha256'], 'Evidence hash differs: ' + item['path'])
    if 'bytes' in item: require(len(raw) == item['bytes'], 'Evidence size differs')
    return raw
def web_id(identifier): return 'prologue' if identifier == 'P00' else 'epilogue' if identifier == 'E00' else 'chapter-' + identifier[1:]
def source_set(sources): return sha(encode([{k: s[k] for k in ('id', 'path', 'sha256')} for s in sources]))

def acceptance(source, relative='editorial/acceptance-v10.json'):
    path = local(source, relative)
    require(path.is_file(), 'Real final acceptance is missing: ' + relative)
    value = read(path)
    require(value.get('schemaVersion') == 1 and value.get('editionVersion') == '10.0' and value.get('decision') == 'accepted-for-release', 'Final v10 acceptance required')
    require(re.fullmatch(r'\d{4}-\d{2}-\d{2}', value.get('releaseDate', '')), 'Real release date required')
    plans = read(local(source, 'planning/chapters.json'))
    require([p['id'] for p in plans] == IDS, 'Expected P00, C01..C24, E00 architecture')
    require([s['id'] for s in value['sources']] == IDS, 'Acceptance must pin exactly 26 ordered sources')
    evidence = [record(source, relative)]
    require([p['path'] for p in value['policies']] == POLICIES, 'Pin constitution, chapter plan and quality gates')
    for item in value['policies']: checked(source, item); evidence.append(record(source, item['path']))
    for item in value['sources']:
        require(item['path'] == f"manuscript/chapters/{item['id']}.md", 'Wrong manuscript source path')
        require(item.get('decision') == 'accepted' and item.get('unresolvedMaterialIssues') == 0, 'Unaccepted chapter: ' + item['id'])
        require(item.get('author') and item.get('independentReviewer') and item['author'] != item['independentReviewer'], 'Independent chapter reader required')
        checked(source, item)
        checked(source, item['evidence']); evidence.append(record(source, item['evidence']['path']))
    require(value.get('sourceSetSha256') == source_set(value['sources']), 'Whole-book source set changed')
    for scope in REVIEW_SCOPES + ['authorApproval']:
        review = value[scope] if scope == 'authorApproval' else value['wholeBook'][scope]
        require(review.get('reviewer') and review.get('decision') == 'accepted', 'Missing review: ' + scope)
        require(review.get('sourceSetSha256') == value['sourceSetSha256'], 'Review covers a different corpus: ' + scope)
        checked(source, review['evidence']); evidence.append(record(source, review['evidence']['path']))
    return value, plans, {e['path']: e for e in evidence}.values()

def projection(source, accepted, plans):
    chapters, notes, parts = [], [], []
    for item, plan in zip(accepted['sources'], plans):
        ident = web_id(item['id'])
        title, blocks, local_notes, heading = manuscript_v10.parse(checked(source, item), ident, plan['title'])
        if plan['part'] and item['id'].startswith('C') and not any(p['id'] == f"part-{plan['part']}" for p in parts):
            parts.append({'id': f"part-{plan['part']}", 'number': str(plan['part']), 'title': plan['part_title']})
        chapters.append({'id': ident, 'number': plan['number'] if item['id'].startswith('C') else None, 'title': title,
                         'part': plan['part_title'] if item['id'].startswith('C') else None,
                         'kind': 'chapter' if item['id'].startswith('C') else 'frontmatter' if item['id'] == 'P00' else 'backmatter',
                         'status': 'available', 'publicationStatus': 'published', 'contentKind': 'manuscript', 'version': '10.0',
                         'editorialStatus': 'independent-agent-editorial-review', 'blocks': blocks,
                         'source': {'path': 'manuscript/v10/sources/' + item['id'] + '.md', 'sha256': item['sha256']},
                         **({'notesHeading': heading} if heading else {})})
        notes.extend(local_notes)
    return {'schemaVersion': 2, 'title': 'Право на решение', 'subtitle': 'Как остаться авторами будущего рядом с более сильным интеллектом',
            'edition': accepted['releaseDate'], 'editionVersion': '10.0', 'version': '10.0', 'publicationStatus': 'published',
            'contentKind': 'manuscript', 'parts': parts, 'chapters': chapters, 'notes': notes,
            'statistics': {'sections': 26, 'chapters': 24, 'availableChapters': 24, 'plannedChapters': 0, 'parts': len(parts), 'notes': len(notes)}}

def whole_markdown(book, sources):
    """Add full-book title matter; retain each source's local notes unchanged."""
    return '# ' + book['title'] + '\n\n' + book['subtitle'] + '\n\n' + AUTHORS + '\n\n' + '\n\n'.join(raw.decode('utf-8-sig').strip() for raw in sources) + '\n'


def _pdf_operations_page(page, operations):
    """An extraction-only copy; the actual PDF and its page remain unchanged."""
    from pypdf.generic import ContentStream, DecodedStreamObject, NameObject
    selected = ContentStream(None, page.pdf)
    selected.operations = operations
    stream = DecodedStreamObject()
    # Reparse the bytes when extracting, preserving the original font decoding.
    stream.set_data(selected.get_data())
    result = copy.copy(page)
    result[NameObject('/Contents')] = stream
    return result


def pdf_body_page(page, number):
    """Exclude only a verified, separately tagged pagination artifact.

    The v10 renderer has a 63.8 pt bottom body margin and a centered footer.
    A body number, even one equal to the page number, is never a match merely
    because of its text. Unknown/missing footer structure fails closed.
    """
    operations = page.get_contents().operations
    stack, ranges = [], []
    for index, (args, operator) in enumerate(operations):
        if operator in (b'BMC', b'BDC'):
            stack.append((index, str(args[0])))
        elif operator == b'EMC':
            require(stack, 'PDF has unbalanced marked content')
            start, tag = stack.pop()
            if tag == '/Artifact':
                ranges.append((start, index + 1))
    require(not stack, 'PDF has unclosed marked content')
    removed = set()
    matches = 0
    for start, end in ranges:
        candidate = _pdf_operations_page(page, operations[start:end])
        spans = []
        def collect(text, cm, tm, font, size):
            if text.strip():
                x = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
                y = tm[4] * cm[1] + tm[5] * cm[3] + cm[5]
                spans.append((text, x, y, size))
        text = candidate.extract_text(visitor_text=collect) or ''
        center = (float(page.mediabox.left) + float(page.mediabox.right)) / 2
        if text.strip() != str(number) or len(spans) != 1:
            continue
        _, x, y, size = spans[0]
        if not (abs(x - center) <= 24 and 28 <= y < 63.8 and 8 <= size <= 14):
            continue
        # Only a self-contained text artifact may be removed; never images,
        # drawing paths, or a group that changes the surrounding graphics state.
        allowed = {b'BMC', b'BDC', b'EMC', b'q', b'Q', b'rg', b'g', b'k', b'BT', b'ET', b'Td', b'Tm', b'Tf', b'Tj', b'TJ'}
        selected = [op for _, op in operations[start:end]]
        require(all(op in allowed for op in selected) and selected.count(b'q') == selected.count(b'Q') == 1 and selected.count(b'BT') == selected.count(b'ET') == 1, 'Unrecognized PDF footer operations')
        removed.update(range(start, end))
        matches += 1
    require(matches == (0 if number == 1 else 1), f'PDF page {number}: expected one verified footer, none on cover')
    return _pdf_operations_page(page, [op for index, op in enumerate(operations) if index not in removed])


def verify_pdf_visible_text(pages, expected):
    """Check all visible body text, including extra characters, across pages."""
    normalize = lambda text: re.sub(r'[\s\u00ad]+', '', text)
    # LibreOffice's content order preserves whole table cells. Geometric layout
    # interleaves the lines of neighbouring wrapped cells and changes that order.
    actual = normalize('\n'.join(page.extract_text() or '' for page in pages))
    wanted = normalize('\n'.join(expected))
    if actual != wanted:
        offset = next((i for i, (a, b) in enumerate(zip(actual, wanted)) if a != b), min(len(actual), len(wanted)))
        raise ValueError('PDF visible text differs at ' + str(offset) + ': expected ' + repr(wanted[offset:offset + 90]) + ', found ' + repr(actual[offset:offset + 90]))


def documents(book, destination):
    """Reuse the deterministic OOXML renderer; global numbering only in whole-book export."""
    whole = {'id': 'whole-book-v10', 'title': book['title'], 'version': '10.0', 'blocks': []}
    notes = copy.deepcopy(book['notes'])
    numbers = {n['id']: str(i + 1) for i, n in enumerate(notes)}
    blocks = [{'type': 'paragraph', 'id': 'book-subtitle', 'text': book['subtitle']}, {'type': 'paragraph', 'id': 'book-authors', 'text': AUTHORS}]
    for chapter in book['chapters']:
        blocks.append({'type': 'heading', 'level': 2, 'id': chapter['id'], 'text': chapter['title'], 'pageBreakBefore': True})
        blocks.extend(copy.deepcopy(chapter['blocks']))
    for block in blocks:
        for run in manuscript_v10.runs(block):
            if run.get('noteId'): run['text'] = '[' + numbers[run['noteId']] + ']'
        if block['type'] == 'table': block['rows'] = [[''.join(r['text'] for r in cell) for cell in row] for row in block['cellRuns']]
        elif block.get('runs'): block['text'] = ''.join(r['text'] for r in block['runs'])
    for note in notes: note['number'] = int(numbers[note['id']])
    whole['blocks'] = blocks
    docx = destination / 'right-to-decide-v10.0.docx'
    cover = (ROOT / COVER).read_bytes()
    docx.write_bytes(book_cover_v10.prepend(chapter_docx_v10.build(whole, notes), cover))
    with ZipFile(docx) as archive:
        require(archive.read(book_cover_v10.MEDIA) == cover, 'DOCX cover differs from supplied image')
        xml = ET.fromstring(archive.read('word/document.xml'))
        actual = [''.join('\n' if t.tag == '{'+chapter_docx_v7.W+'}br' else t.text or '' for t in p.iter() if t.tag in ['{'+chapter_docx_v7.W+'}t', '{'+chapter_docx_v7.W+'}br']) for p in xml.iter('{'+chapter_docx_v7.W+'}p')]
    require(actual[0] == '' and xml.find('.//{'+book_cover_v10.W+'}drawing') is not None, 'Missing cover paragraph')
    actual = actual[1:]
    expected = chapter_docx_v7.document_lines(whole, notes)
    require(actual == expected, 'DOCX complete visible text differs from JSON')
    require(len(xml.findall('.//{'+chapter_docx_v7.W+'}pageBreakBefore')) == len(book['chapters']) + 1, 'DOCX section page breaks differ (plus original title after cover)')
    spec = importlib.util.spec_from_file_location('v10_pdf_converter', ROOT / GENERATOR_FILES[-1])
    converter = importlib.util.module_from_spec(spec); spec.loader.exec_module(converter)
    pdf = converter.build_pdf(docx, converter.OFFICE)
    from pypdf import PdfReader
    pages = PdfReader(pdf).pages
    require(len(pages) >= 2, 'PDF cover must be followed by the original title page')
    require(not (pages[0].extract_text() or '').strip(), 'PDF cover contains body text or a page number')
    cover_paints = []
    pages[0].extract_text(visitor_operand_before=lambda op, args, cm, tm: cover_paints.append(args[0]) if op == b'Do' else None)
    require(cover_paints and pages[0].images, 'PDF first page does not paint the cover image')
    normalize = lambda text: re.sub(r'[\s\u00ad]+', '', text)
    require(normalize(whole['title']) in normalize(pages[1].extract_text() or ''), 'PDF original title did not start on the second page')
    body_pages = [pdf_body_page(page, index + 1) for index, page in enumerate(pages)]
    # Use the same structurally verified body for section starts and full text.
    page_bodies = [normalize(page.extract_text() or '') for page in body_pages]
    section_pages = []
    previous = 1  # zero-based: cover, original title, then the manuscript sections
    for chapter in book['chapters']:
        found = next((index for index in range(previous + 1, len(pages)) if page_bodies[index].startswith(normalize(chapter['title']))), None)
        require(found is not None, 'PDF section does not start a new page: ' + chapter['title'])
        section_pages.append(found + 1)
        previous = found
    verify_pdf_visible_text(body_pages, expected)
    return {'docxVisibleTextExact': True, 'pdfVisibleTextInOrder': True, 'pdfPages': len(pages), 'globalNoteCount': len(notes), 'coverSha256': sha(cover), 'pdfCoverFirstPageUnnumbered': True, 'pdfTitleOnSecondPage': True, 'docxSectionStartsNewPage': True, 'pdfSectionStartPages': section_pages}

def prepare(source, stage, acceptance_path):
    accepted, plans, evidence = acceptance(source, acceptance_path)
    book = projection(source, accepted, plans)
    dossier_manifest, dossier_data, dossier_outputs = public_dossiers_v10.collect(source, checked, require)
    library_manifest, library_data, library_outputs = public_library_v10.collect(source, checked, require)
    team_manifest, team_data, team_outputs = public_editorial_v10.collect(source, checked, require)
    themes={s["category"] for s in library_data["sources"]}
    require(all(t in themes for r in team_data["roles"] for t in r["libraryThemes"]), "Editorial theme absent from accepted bibliography")
    require(not stage.exists(), 'Staging directory exists; use a new empty destination')
    require(stage.resolve().is_relative_to(ROOT) and not stage.resolve().is_relative_to(ROOT / 'public'), 'Stage must be inside worktree and outside public')
    generators = [record(ROOT, p) for p in GENERATOR_FILES + ['scripts/public_dossiers_v10.py','scripts/public_library_v10.py','scripts/public_editorial_v10.py','scripts/book_cover_v10.py',COVER]]
    identity = {'acceptance': accepted, 'plans': plans, 'generators': generators, 'publicDossiers': dossier_manifest, 'publicLibrary':library_manifest, 'publicEditorial':team_manifest}
    identity_sha = sha(encode(identity))
    book['releaseId'] = 'literary-manuscript-v10.0-' + identity_sha[:12]
    book['source'] = {'filename': 'release-manifest.json', 'path': MANIFEST, 'format': 'markdown-manuscript', 'sha256': identity_sha,
                      'importer': 'scripts/release_v10.py', 'textPolicy': 'Зафиксированный текст редакции 10.0. Независимая агентная редакционная проверка; внешняя экспертиза не заявляется.'}
    # All source and acceptance validation precedes any filesystem mutation.
    stage.mkdir(parents=True)
    try:
        for relative, raw in {**dossier_outputs, **library_outputs, **team_outputs, 'src/data/editorial-team-v10.json':encode(team_data), 'manuscript/v10/public-editorial-manifest.json':encode(team_manifest), 'src/data/research-v10.json': encode(dossier_data), 'manuscript/v10/public-dossiers-manifest.json': encode(dossier_manifest), 'src/data/library-v10.json':encode(library_data), 'manuscript/v10/public-library-manifest.json':encode(library_manifest)}.items():
            target = local(stage, relative); target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
        evidence_records = []
        for item in evidence:
            target = 'manuscript/v10/evidence/' + item['path']
            path = local(stage, target); path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(checked(source, item))
            evidence_records.append(record(stage, target))
        for item in accepted['sources']:
            target = local(stage, 'manuscript/v10/sources/' + item['id'] + '.md'); target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(checked(source, item))
        downloads = stage / 'public/book'; downloads.mkdir(parents=True)
        checks = documents(book, downloads)
        # Exact local-numbered Markdown sources remain available as a single reading file.
        markdown = whole_markdown(book, (checked(source, i) for i in accepted['sources']))
        require(not re.search(r'book-memory|file://|(?<!\w)[A-Za-z]:[\\/]', markdown, re.I), 'Private local path in manuscript')
        (downloads / 'right-to-decide-v10.0.md').write_bytes(markdown.encode('utf-8'))
        book['downloads'] = {kind: {'path': '/book/right-to-decide-v10.0.' + kind, **{k: v for k, v in record(stage, 'public/book/right-to-decide-v10.0.' + kind).items() if k != 'path'}} for kind in ['docx', 'pdf', 'md']}
        for chapter in book['chapters']:
            relative = 'public/book/chapters/' + chapter['id'] + '-v10.0.docx'
            target = local(stage, relative); target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(chapter_docx_v10.build(chapter, [n for n in book['notes'] if n['chapterId'] == chapter['id']]))
            chapter['download'] = {'docx': '/' + relative.removeprefix('public/'), 'sha256': sha(target.read_bytes()), 'bytes': target.stat().st_size}
        target = stage / 'src/data/book.json'; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(encode(book))
        # Recheck author sources after conversion; a concurrent edit invalidates the complete stage.
        acceptance(source, acceptance_path)
        require(public_dossiers_v10.collect(source, checked, require) == (dossier_manifest, dossier_data, dossier_outputs), 'Public dossiers changed during conversion')
        require(public_library_v10.collect(source, checked, require) == (library_manifest,library_data,library_outputs), 'Public bibliography changed during conversion')
        require(public_editorial_v10.collect(source,checked,require)==(team_manifest,team_data,team_outputs), 'Public editorial text changed during conversion')
        manifest = {'schemaVersion': 1, 'editionVersion': '10.0', 'releaseId': book['releaseId'], 'releaseDate': book['edition'],
                    'status': 'prepared-for-static-release', 'published': False, 'acceptanceStatus': 'independent-editorial-review',
                    'bookSha256': sha(encode(book)), 'sourceSetSha256': accepted['sourceSetSha256'], 'generators': generators,
                    'sources': [c['source'] for c in book['chapters']], 'evidence': evidence_records,
                    'acceptancePath': 'manuscript/v10/evidence/' + acceptance_path, 'checks': checks,
                    'archiveV9': record(ROOT, ARCHIVE), 'annotationTransfer': 'none'}
        manifest['artifacts'] = [record(stage, p.relative_to(stage).as_posix()) for p in sorted(stage.rglob('*')) if p.is_file()]
        (stage / MANIFEST).write_bytes(encode(manifest))
        verify(stage)
    except Exception:
        # Keep failed work for diagnosis, but never install without a valid manifest/check.
        raise
    print('V10 PREPARED; not installed or published: ' + str(stage))

def verify(base):
    manifest = read(base / MANIFEST); book = read(base / 'src/data/book.json')
    require(manifest['editionVersion'] == book['editionVersion'] == '10.0', 'Not v10')
    require(sha((base / 'src/data/book.json').read_bytes()) == manifest['bookSha256'], 'Book projection changed')
    require(book['releaseId'] == manifest['releaseId'] and [c['id'] for c in book['chapters']] == [web_id(i) for i in IDS], 'Wrong release architecture')
    for item in manifest['artifacts']: checked(base, item)
    for item in manifest['generators']: checked(ROOT, item)
    checked(ROOT, manifest['archiveV9'])
    for item in read(ROOT/'docs/publishing/v10/archive-library-v9.json')['files']: checked(ROOT,item)
    for item in read(ROOT/'docs/publishing/v10/archive-editorial-v9.json')['files']: checked(ROOT,item)
    frozen = base / 'manuscript/v10/evidence'
    accepted = read(base / manifest['acceptancePath'])
    for item, chapter in zip(accepted['sources'], book['chapters']):
        raw = checked(base, chapter['source'])
        require(sha(raw) == item['sha256'], 'Accepted source changed')
        _, blocks, notes, _ = manuscript_v10.parse(raw, chapter['id'], chapter['title'])
        require(blocks == chapter['blocks'] and notes == [n for n in book['notes'] if n['chapterId'] == chapter['id']], 'Source projection differs')
    require(source_set(accepted['sources']) == accepted['sourceSetSha256'] == manifest['sourceSetSha256'], 'Source set differs')
    for policy in accepted['policies']: checked(frozen, policy)
    require(manifest['annotationTransfer'] == 'none' and all(manifest['checks'][k] is True for k in ['docxVisibleTextExact', 'pdfVisibleTextInOrder']), 'Incomplete export checks')
    return manifest

def install(stage):
    manifest = verify(stage)
    current = read(ROOT / 'src/data/book.json')
    require(current['editionVersion'] == '9.0' or current.get('releaseId') == manifest['releaseId'], 'Unexpected active edition; explicit new transition needed')
    if current['editionVersion'] == '9.0':
        require((ROOT / 'src/data/book.json').read_bytes() == (ROOT / ARCHIVE).read_bytes(), 'Actual v9 differs from immutable archive')
    for item in read(ROOT/'docs/publishing/v10/archive-library-v9.json')['files']: checked(ROOT,item)
    for item in read(ROOT/'docs/publishing/v10/archive-editorial-v9.json')['files']: checked(ROOT,item)
    archive_manifest = read(ROOT / 'docs/publishing/v10/archive-v9.json')
    for item in archive_manifest['files']: checked(ROOT, item)
    # Manifest is checked in full before mutation. Historical files are never rewritten.
    for item in manifest['artifacts'] + [record(stage, MANIFEST)]:
        target = local(ROOT, item['path']); target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(checked(stage, item))
    print('V10 installed in local checkout. Run npm run check; publication is a separate action.')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'check', 'install', 'source-set'])
    parser.add_argument('--source', type=Path, default=ROOT.parent / 'book-v10')
    parser.add_argument('--stage', type=Path, default=ROOT / '.release-staging/v10')
    parser.add_argument('--acceptance', default='editorial/acceptance-v10.json')
    args = parser.parse_args()
    stage = args.stage.resolve()
    if args.action == 'source-set':
        items = [{'id': i, **record(args.source, f'manuscript/chapters/{i}.md')} for i in IDS]
        print(json.dumps({'sources': items, 'sourceSetSha256': source_set(items)}, ensure_ascii=False, indent=2)); return
    if args.action == 'prepare': prepare(args.source.resolve(), stage, args.acceptance)
    elif args.action == 'install': install(stage)
    else: verify(stage if (stage / MANIFEST).exists() else ROOT); print('V10 source, projection, archive and artifacts verified')
if __name__ == '__main__': main()
