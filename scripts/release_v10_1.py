"""Prepare/check/install accepted 10.1 (28 sections). No network or publication."""
from __future__ import annotations
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path, PurePosixPath, PureWindowsPath
import re
import shutil
import tempfile
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import manuscript_v10
import chapter_docx_v7
import chapter_docx_v10
import public_packages_v10_1 as packages
import book_cover_v10

ROOT = Path(__file__).resolve().parents[1]
IDS = packages.IDS
VERSION = '10.1'
REVIEW_SCOPES = ['continuousReading', 'factualReview', 'alternativesReview', 'continuityReview', 'repetitionReview']
POLICIES = ['CONSTITUTION.md', 'planning/chapters.json', 'editorial/QUALITY_GATES.md', 'BOOK_METADATA.json']
MANIFEST = 'manuscript/v10-1/release-manifest.json'
COVER = 'public/images/book-cover-v10-1.png'
AUTHORS = 'А. М. Давыдов · А. А. Давыдов · Е. А. Давыдов'
GENERATOR_FILES = ['scripts/release_v10_1.py', 'scripts/manuscript_v10.py', 'scripts/chapter_docx_v10.py', 'scripts/chapter_docx_v7.py', 'scripts/chapter_docx.py', 'scripts/manuscript_markdown.py', 'manuscript/2026-09-06-corpus-rebuild/technical/manuscript_v9.py', 'manuscript/2026-09-05-rebuild/build_reading_documents.py']
def encode(value): return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
def sha(raw): return hashlib.sha256(raw).hexdigest()
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def require(condition, message):
    if not condition: raise ValueError(message)
def local(root, relative):
    require(isinstance(relative, str) and '\\' not in relative and not PurePosixPath(relative).is_absolute() and not PureWindowsPath(relative).drive and all(p not in ['', '.', '..'] for p in relative.split('/')), 'Unsafe relative path')
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
def web_id(identifier): return 'prologue' if identifier == 'P00' else 'epilogue' if identifier == 'E00' else 'chapter-' + identifier[1:].lower()
def source_set(sources): return sha(encode([{k: s[k] for k in ('id', 'path', 'sha256')} for s in sources]))

def public_attestation(source, item):
    require(re.fullmatch(r'editorial/release-attestations(?:-v10-1)?/[A-Za-z0-9_-]+\.json', item['path']), 'Only safe release attestations may be exported')
    raw=checked(source,item)
    require(len(raw)<=32768, 'Full private dossier cannot be a public attestation')
    data=json.loads(packages.public_text(raw,require))
    fields={'schemaVersion','chapter','sourceSha256','author','lastIntegrationEditor','reviewer','decision','unresolvedMaterialIssues','reviewType','basis','amendmentDisclosure','scope','grounds','limits','sourceSetSha256','preparedAgentReader','externalHumanExpertise','recordedBy','authority','instructionExcerpt','meaning','technicalReleaseCondition','readingScope','aggregationDisclosure'}
    require(set(data)<=fields,'Unreviewed fields in public attestation')
    if 'basis' in data:
        require(set(data['basis'])=={'report','sha256','retention'} and '/' not in data['basis']['report'] and '\\' not in data['basis']['report'], 'Public basis must name a report without its private path')
    return data


def acceptance(source, relative='editorial/acceptance-v10-1.json', bundled_sources=None):
    path = local(source, relative)
    require(path.is_file(), 'Real final acceptance is missing: ' + relative)
    value = read(path)
    require(value.get('schemaVersion') == 1 and value.get('editionVersion') == '10.1' and value.get('decision') == 'accepted-for-release', 'Final v10.1 acceptance required')
    require(re.fullmatch(r'\d{4}-\d{2}-\d{2}', value.get('releaseDate', '')), 'Real release date required')
    plans = read(local(source, 'planning/chapters.json'))
    require([p['id'] for p in plans] == IDS, 'Expected 28 sections with C11A/C11B before C12')
    require([s['id'] for s in value['sources']] == IDS, 'Acceptance must pin exactly 28 ordered sources')
    evidence = [record(source, relative)]
    require([p['path'] for p in value['policies']] == POLICIES, 'Pin constitution, chapter plan, quality gates and BOOK_METADATA')
    for item in value['policies']: checked(source, item); evidence.append(record(source, item['path']))
    for item in value['sources']:
        require(item['path'] == f"manuscript/chapters/{item['id']}.md", 'Wrong manuscript source path')
        require(item.get('decision') == 'accepted' and item.get('unresolvedMaterialIssues') == 0, 'Unaccepted chapter: ' + item['id'])
        require(item.get('author') and item.get('independentReviewer') and item['author'] != item['independentReviewer'], 'Independent chapter reader required')
        raw = checked(source, item) if bundled_sources is None else checked(bundled_sources, {'path':'sources/'+item['id']+'.md','sha256':item['sha256']})
        packages.public_text(raw, require)
        attestation = public_attestation(source, item['evidence'])
        require(attestation.get('chapter') == item['id'] and attestation.get('sourceSha256') == item['sha256'], 'Chapter attestation covers different bytes')
        require(attestation.get('author') == item['author'] and attestation.get('reviewer') == item['independentReviewer'] and attestation.get('decision') == 'accepted' and attestation.get('unresolvedMaterialIssues') == 0, 'Chapter attestation contradicts acceptance')
        evidence.append(record(source, item['evidence']['path']))
    require(value.get('sourceSetSha256') == source_set(value['sources']), 'Whole-book source set changed')
    for scope in REVIEW_SCOPES:
        review = value['wholeBook'][scope]
        require(review.get('reviewer') and review.get('decision') == 'accepted', 'Missing review: ' + scope)
        require(review.get('sourceSetSha256') == value['sourceSetSha256'], 'Review covers a different corpus: ' + scope)
        attestation = public_attestation(source, review['evidence'])
        require(attestation.get('sourceSetSha256') == value['sourceSetSha256'] and attestation.get('decision') == 'accepted', 'Whole-book attestation covers a different corpus')
        require(attestation.get('scope') == scope and attestation.get('reviewer') == review['reviewer'], 'Whole-book attestation identity differs')
        evidence.append(record(source, review['evidence']['path']))
    authorization = value['authorApproval']
    require(authorization.get('scope') == 'publication-authorization' and authorization.get('reviewer') == 'user-direct-instruction' and authorization.get('decision') == 'authorized', 'Publication authority must not claim human reading acceptance')
    require(authorization.get('sourceSetSha256') == value['sourceSetSha256'], 'Authorization record must identify current corpus')
    authority = authorization['authorityEvidence']
    require(authority['path'] == 'editorial/AUTHOR_DECISION_2026-09-13_FINAL_PATCH.md', 'Pin actual current author instruction')
    packages.public_text(checked(source, authority), require)
    evidence.append(record(source, authority['path']))
    note = public_attestation(source, authorization['evidence'])
    require(note.get('scope') == 'publication-authorization' and note.get('decision') == 'authorized' and note.get('sourceSetSha256') == value['sourceSetSha256'], 'Authorization note differs from standing user instruction')
    evidence.append(record(source, authorization['evidence']['path']))
    metadata = read(local(source, 'BOOK_METADATA.json'))
    require(all(isinstance(metadata.get(k), str) and metadata[k] for k in ['title','subtitle','final_sentence','epilogue_sentence']), 'Book metadata requires title, subtitle and exact endings')
    for identifier, key in [('C24','final_sentence'), ('E00','epilogue_sentence')]:
        item = next(i for i in value['sources'] if i['id'] == identifier)
        raw = checked(source,item) if bundled_sources is None else checked(bundled_sources,{'path':'sources/'+identifier+'.md','sha256':item['sha256']})
        body = raw.decode('utf-8-sig').replace('\r\n', '\n').replace('\r', '\n').split('## Примечания')[0].strip()
        require(body.split('\n\n')[-1].replace('**','').strip() == metadata[key], 'Exact author ending differs: '+identifier)
    return value, plans, list({e['path']: e for e in evidence}.values())

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
                         'status': 'available', 'publicationStatus': 'published', 'contentKind': 'manuscript', 'version': '10.1',
                         'editorialStatus': 'independent-agent-editorial-review', 'blocks': blocks,
                         'source': {'path': 'manuscript/v10-1/sources/' + item['id'] + '.md', 'sha256': item['sha256']},
                         **({'notesHeading': heading} if heading else {})})
        notes.extend(local_notes)
    metadata = read(local(source, 'BOOK_METADATA.json'))
    return {'schemaVersion': 2, 'title': metadata['title'], 'subtitle': metadata['subtitle'],
            'edition': accepted['releaseDate'], 'editionVersion': '10.1', 'version': '10.1', 'publicationStatus': 'published',
            'contentKind': 'manuscript', 'parts': parts, 'chapters': chapters, 'notes': notes,
            'statistics': {'sections': 28, 'chapters': 26, 'availableChapters': 26, 'plannedChapters': 0, 'parts': len(parts), 'notes': len(notes)}}

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
    whole = {'id': 'whole-book-v10', 'title': book['title'], 'version': '10.1', 'blocks': []}
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
    docx = destination / 'right-to-decide-v10.1.docx'
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

def public_packages(source):
    dossier=packages.collect_dossiers(source,checked,require)
    library=packages.collect_library(source,checked,require)
    team=packages.collect_editorial(source,checked,require)
    essence=packages.collect_essence(source,checked,require)
    themes={x['category'] for x in library[1]['sources']}
    require(all(t in themes for r in team[1]['roles'] for t in r['libraryThemes']), 'Editorial theme absent from public sources')
    require(essence[1]['subtitle']==read(source/'BOOK_METADATA.json')['subtitle'], 'Essence subtitle differs')
    return dossier,library,team,essence


def prepare(source, stage, acceptance_path):
    accepted, plans, evidence = acceptance(source, acceptance_path)
    book = projection(source, accepted, plans)
    selected=public_packages(source)
    dossier,library,team,essence=selected
    require(not stage.exists(), 'Staging directory exists; use a new empty destination')
    require(stage.resolve().is_relative_to(ROOT.resolve()) and not stage.resolve().is_relative_to((ROOT/'public').resolve()) and not stage.resolve().is_relative_to((ROOT/'manuscript').resolve()), 'Stage must be inside worktree, outside publication and manuscript')
    generators=[record(ROOT,p) for p in GENERATOR_FILES+['scripts/public_packages_v10_1.py','scripts/public_library_v10.py','scripts/public_editorial_v10.py','scripts/book_cover_v10.py',COVER]]
    public_receipts={'publicDossiers':dossier[0],'publicLibrary':library[0],'publicEditorial':team[0],'publicEssence':essence[0]}
    identity={'acceptance':accepted,'plans':plans,'generators':generators,**public_receipts}
    identity_sha=sha(encode(identity))
    book['releaseId']='literary-manuscript-v10.1-'+identity_sha[:12]
    book['source']={'filename':'release-manifest.json','path':MANIFEST,'format':'markdown-manuscript','sha256':identity_sha,'importer':'scripts/release_v10_1.py','textPolicy':'Зафиксированный текст редакции 10.1. Независимая агентная редакционная проверка; внешняя экспертиза не заявляется.'}
    # All required author, source and public acceptance checks precede mutation.
    stage.mkdir(parents=True)
    outputs={}
    for package in selected:
        require(not set(outputs)&set(package[2]),'Two packages target the same file')
        outputs.update(package[2])
    outputs.update({'src/data/research-v10.json':encode(dossier[1]),'src/data/library-v10.json':encode(library[1]),'src/data/editorial-team-v10.json':encode(team[1])})
    for name,receipt in public_receipts.items():
        outputs['manuscript/v10-1/'+name+'.json']=encode(receipt)
    outputs[COVER]=(ROOT/COVER).read_bytes()
    for relative,raw in outputs.items():
        path=local(stage,relative);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
    evidence_records=[]
    for item in evidence:
        relative='manuscript/v10-1/evidence/'+item['path']
        target=local(stage,relative);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(checked(source,item))
        evidence_records.append(record(stage,relative))
    for item in accepted['sources']:
        target=local(stage,'manuscript/v10-1/sources/'+item['id']+'.md');target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(checked(source,item))
    downloads=stage/'public/book';downloads.mkdir(parents=True)
    checks=documents(book,downloads)
    markdown=whole_markdown(book,(checked(source,item) for item in accepted['sources']))
    packages.public_text(markdown.encode('utf-8'),require)
    (downloads/'right-to-decide-v10.1.md').write_bytes(markdown.encode('utf-8'))
    book['downloads']={kind:{'path':'/book/right-to-decide-v10.1.'+kind,**{k:v for k,v in record(stage,'public/book/right-to-decide-v10.1.'+kind).items() if k!='path'}} for kind in ['docx','pdf','md']}
    for chapter in book['chapters']:
        relative='public/book/chapters/'+chapter['id']+'-v10.1.docx'
        target=local(stage,relative);target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(chapter_docx_v10.build(chapter,[n for n in book['notes'] if n['chapterId']==chapter['id']]))
        chapter['download']={'docx':'/'+relative.removeprefix('public/'),'sha256':sha(target.read_bytes()),'bytes':target.stat().st_size}
    (stage/'src/data/book.json').write_bytes(encode(book))
    require(acceptance(source,acceptance_path)[0]==accepted,'Accepted corpus changed during document conversion')
    require(public_packages(source)==selected,'Public package changed during conversion')
    require(all(record(ROOT,g['path'])==g for g in generators),'Generator or cover changed during conversion')
    manifest={'schemaVersion':1,'editionVersion':VERSION,'releaseId':book['releaseId'],'releaseDate':book['edition'],'status':'prepared-for-static-release','published':False,'acceptanceStatus':'independent-editorial-review','bookSha256':sha(encode(book)),'sourceSetSha256':accepted['sourceSetSha256'],'generators':generators,'sources':[c['source'] for c in book['chapters']],'evidence':evidence_records,'acceptancePath':'manuscript/v10-1/evidence/'+acceptance_path,'checks':checks,'annotationTransfer':'none','publicReceipts':{name:'manuscript/v10-1/'+name+'.json' for name in public_receipts}}
    manifest['artifacts']=[record(stage,p.relative_to(stage).as_posix()) for p in sorted(stage.rglob('*')) if p.is_file()]
    (stage/MANIFEST).write_bytes(encode(manifest))
    verify(stage)
    print('V10.1 PREPARED; not installed or published: '+str(stage))


def allowed_artifact(path):
    return (path in {'src/data/book.json','src/data/research-v10.json','src/data/library-v10.json','src/data/library-source-cards.json','src/data/editorial-team-v10.json','src/data/manifesto-v10.json','src/data/essence-v10-1.json',COVER}
            or path.startswith(('manuscript/v10-1/','public/research/v10/','public/library/v10/','public/editorial/v10/','public/manifesto/v10/'))
            or bool(re.fullmatch(r'public/book/(?:right-to-decide-v10\.1\.(?:md|docx|pdf)|chapters/(?:prologue|epilogue|chapter-[0-9]{2}[ab]?)-v10\.1\.docx)',path)))


def verify_public_packages(base, receipts):
    """Rebuild projections from pinned public source bytes, without private files."""
    manifest_paths={'publicDossiers':'public/research-v10/manifest.json','publicLibrary':'public/library-v10/manifest.json','publicEditorial':'public/editorial-v10/manifest.json','publicEssence':'public/essence-v10-1-manifest.json'}
    virtual={manifest_paths[key]:encode(value) for key,value in receipts.items()}
    mapping={}
    dossier=receipts['publicDossiers']
    for item in dossier['texts']:
        name='index' if item['id']=='INDEX' else item['id']
        mapping[item['path']]='public/research/v10/'+name+'.md'
    for item in dossier['downloads']:mapping[item['path']]='public/research/v10/files/'+item['name']
    mapping[receipts['publicLibrary']['cards']['path']]='src/data/library-source-cards.json'
    for key,target in [('team','public/editorial/v10/team.json'),('text','public/editorial/v10/team.md'),('manifesto','public/manifesto/v10/manifesto.md')]:
        mapping[receipts['publicEditorial'][key]['path']]=target
    mapping[receipts['publicEssence']['content']['path']]='src/data/essence-v10-1.json'
    class VirtualPath:
        def __init__(self,path=''):self.path=path
        def __truediv__(self,other):return VirtualPath(self.path+'/'+other if self.path else other)
        def is_file(self):return self.path in virtual
        def read_text(self,encoding='utf-8-sig'):return virtual[self.path].decode(encoding)
    def get(_,item):
        require(item['path'] in mapping,'Unbound public source')
        return checked(base,{**item,'path':mapping[item['path']]})
    selected=[collector(VirtualPath(),get,require) for collector in [packages.collect_dossiers,packages.collect_library,packages.collect_editorial,packages.collect_essence]]
    expected={}
    for package in selected:expected.update(package[2])
    expected.update({'src/data/research-v10.json':encode(selected[0][1]),'src/data/library-v10.json':encode(selected[1][1]),'src/data/editorial-team-v10.json':encode(selected[2][1])})
    for path,raw in expected.items():require(local(base,path).read_bytes()==raw,'Public source projection differs: '+path)
    return set(expected)


def _verify(base, *, current_generators=True):
    manifest=read(base/MANIFEST);book=read(base/'src/data/book.json')
    require(manifest.get('editionVersion')==book.get('editionVersion')==VERSION,'Not edition 10.1')
    require(sha((base/'src/data/book.json').read_bytes())==manifest['bookSha256'],'Book projection changed')
    require(book['releaseId']==manifest['releaseId'] and [c['id'] for c in book['chapters']]==[web_id(i) for i in IDS],'Wrong 28-section architecture')
    require(book['statistics']['sections']==28 and book['statistics']['chapters']==26,'Wrong section counts')
    paths=[x['path'] for x in manifest['artifacts']]
    require(len(paths)==len(set(paths)) and all(allowed_artifact(p) and p!=MANIFEST for p in paths),'Unsafe or duplicate release artifact')
    for item in manifest['artifacts']:checked(base,item)
    if current_generators:
        for item in manifest['generators']:checked(ROOT,item)
    frozen=base/'manuscript/v10-1/evidence'
    prefix='manuscript/v10-1/evidence/'
    require(manifest['acceptancePath'].startswith(prefix),'Unexpected acceptance export path')
    accepted,plans,evidence=acceptance(frozen,manifest['acceptancePath'].removeprefix(prefix),base/'manuscript/v10-1')
    require(manifest['evidence']==[record(base,prefix+x['path']) for x in evidence],'Exported evidence inventory differs')
    metadata=read(frozen/'BOOK_METADATA.json')
    require(book['title']==metadata['title'] and book['subtitle']==metadata['subtitle'],'Title or subtitle differs from accepted metadata')
    for item,chapter,plan in zip(accepted['sources'],book['chapters'],plans):
        require(chapter['source']=={'path':'manuscript/v10-1/sources/'+item['id']+'.md','sha256':item['sha256']},'Unexpected projected source')
        raw=checked(base,chapter['source'])
        title,blocks,notes,heading=manuscript_v10.parse(raw,chapter['id'],plan['title'])
        require(title==chapter['title'] and blocks==chapter['blocks'] and notes==[n for n in book['notes'] if n['chapterId']==chapter['id']] and heading==chapter.get('notesHeading'),'Exact source projection differs')
        require(chapter['version']==VERSION and chapter['number']==(plan['number'] if item['id'].startswith('C') else None),'Chapter version or number differs')
    require(source_set(accepted['sources'])==manifest['sourceSetSha256'],'Source set differs')
    receipts={name:read(local(base,path)) for name,path in manifest['publicReceipts'].items()}
    require(set(receipts)=={'publicDossiers','publicLibrary','publicEditorial','publicEssence'},'Missing accepted public package')
    public_files=verify_public_packages(base,receipts)
    identity={'acceptance':accepted,'plans':plans,'generators':manifest['generators'],**receipts}
    digest=sha(encode(identity))
    require(book['releaseId']=='literary-manuscript-v10.1-'+digest[:12] and book['source']['sha256']==digest,'Release identity differs')
    require(manifest['annotationTransfer']=='none' and all(manifest['checks'].get(k) is True for k in ['docxVisibleTextExact','pdfVisibleTextInOrder','pdfCoverFirstPageUnnumbered','pdfTitleOnSecondPage','docxSectionStartsNewPage']),'Incomplete document checks')
    require(len(manifest['checks']['pdfSectionStartPages'])==28,'PDF section count differs')
    # All files claimed by the book, receipts and evidence must be hash-pinned.
    required={'src/data/book.json',COVER,manifest['acceptancePath'],*manifest['publicReceipts'].values(),*[x['path'] for x in manifest['evidence']],*[x['source']['path'] for x in book['chapters']]}
    required.update('public'+x['path'] for x in book['downloads'].values())
    required.update('public'+x['download']['docx'] for x in book['chapters'])
    require(required|public_files==set(paths),'Manifest omits required artifacts or includes undeclared files')
    for kind,item in book['downloads'].items():
        checked(base,{'path':'public'+item['path'],'sha256':item['sha256'],'bytes':item['bytes']})
    for chapter in book['chapters']:
        item=chapter['download'];checked(base,{'path':'public'+item['docx'],'sha256':item['sha256'],'bytes':item['bytes']})
    require(manifest['checks']['coverSha256']==sha((base/COVER).read_bytes()),'Cover identity differs')
    return manifest


def verify(base):
    return _verify(base)


def prepared_replacement(stage, incoming, expected_release_id):
    """Check the exact prior package, retaining its recorded generator identity.

    The caller explicitly identifies a failed, unpublished preparation. The local
    prepared flag alone cannot establish whether a remote deployment occurred.
    Historical generator bytes are not compared with the repaired current code;
    their pinned records still participate in the recomputed prior release ID.
    """
    old=read(ROOT/MANIFEST)
    require(old.get('editionVersion')==VERSION and old.get('releaseId')==expected_release_id,
            'Prepared replacement requires the exact current 10.1 release ID')
    require(old.get('status')=='prepared-for-static-release' and old.get('published') is False,
            'Prepared replacement requires an unpublished preparation record')
    old=_verify(ROOT,current_generators=False)
    require(old['releaseId']!=incoming['releaseId'],'Prepared replacement must have a new technical release ID')
    require(old['sourceSetSha256']==incoming['sourceSetSha256'] and old['sources']==incoming['sources'],
            'Prepared replacement must preserve the accepted source set')
    require(old['acceptancePath']==incoming['acceptancePath'] and
            local(ROOT,old['acceptancePath']).read_bytes()==local(stage,incoming['acceptancePath']).read_bytes(),
            'Prepared replacement must preserve exact acceptance bytes')
    require(old['evidence']==incoming['evidence'],'Prepared replacement must preserve exact evidence bytes')
    require(old['publicReceipts']==incoming['publicReceipts'] and all(
            local(ROOT,path).read_bytes()==local(stage,path).read_bytes() for path in old['publicReceipts'].values()),
            'Prepared replacement must preserve exact public receipts')
    require({item['path'] for item in old['artifacts']}=={item['path'] for item in incoming['artifacts']},
            'Prepared replacement must preserve the artifact inventory')
    return old


def snapshot_transition(targets, destination, current):
    require(not destination.resolve().is_relative_to(ROOT.resolve()),'Transition snapshot must stay outside published Git worktree')
    payload={path:local(ROOT,path).read_bytes() for path in targets if local(ROOT,path).is_file()}
    identity={'schemaVersion':1,'fromVersion':current['editionVersion'],'fromReleaseId':current.get('releaseId'),'files':[{'path':p,'sha256':sha(raw),'bytes':len(raw)} for p,raw in sorted(payload.items())]}
    if destination.exists():
        with ZipFile(destination) as archive:
            require(archive.testzip() is None and json.loads(archive.read('snapshot.json'))==identity,'Existing transition snapshot differs')
            require(all(archive.read(p)==raw for p,raw in payload.items()),'Snapshot file differs')
    else:
        destination.parent.mkdir(parents=True,exist_ok=True)
        with ZipFile(destination,'x') as archive:
            for path,raw in payload.items():archive.writestr(path,raw)
            archive.writestr('snapshot.json',encode(identity))
        with ZipFile(destination) as archive:require(archive.testzip() is None,'Transition snapshot CRC failed')
    return payload


def install(stage, snapshot, replace_prepared_release=None):
    manifest=verify(stage)
    current=read(ROOT/'src/data/book.json')
    if replace_prepared_release is not None:
        require(current.get('editionVersion')==VERSION and current.get('releaseId')==replace_prepared_release,
                'Prepared replacement requires the exact current 10.1 release ID')
        prepared_replacement(stage,manifest,replace_prepared_release)
    else:
        require(current.get('editionVersion')=='10.0' or current.get('releaseId')==manifest['releaseId'],
                'Only explicit 10.0 to 10.1 transition, identical reinstall or explicit prepared replacement is allowed')
    records=manifest['artifacts']+[record(stage,MANIFEST)]
    payload={item['path']:checked(stage,item) for item in records}
    if current.get('releaseId')!=manifest['releaseId']:
        old_manifest=MANIFEST if replace_prepared_release is not None else 'manuscript/v10/release-manifest.json'
        if replace_prepared_release is None:
            require((ROOT/old_manifest).is_file(),'Current 10.0 release identity is missing')
            old=read(ROOT/old_manifest)
            require(old['bookSha256']==sha((ROOT/'src/data/book.json').read_bytes()),'Current 10.0 book differs from its manifest')
        snapshot_transition(set(payload)|{old_manifest},snapshot,current)
    before={path:(local(ROOT,path).read_bytes() if local(ROOT,path).exists() else None) for path in payload}
    try:
        for path,raw in payload.items():
            target=local(ROOT,path);target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(raw)
        verify(ROOT)
    except Exception:
        for path,raw in before.items():
            target=local(ROOT,path)
            if raw is None:
                if target.exists():target.unlink()
            else:target.write_bytes(raw)
        raise
    print('V10.1 installed locally after a private transition snapshot; not published.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['prepare','check','install','source-set'])
    parser.add_argument('--source',type=Path,default=ROOT.parent/'book-v10')
    parser.add_argument('--stage',type=Path,default=ROOT/'.release-staging/v10-1')
    parser.add_argument('--acceptance',default='editorial/acceptance-v10-1.json')
    parser.add_argument('--snapshot',type=Path,default=ROOT.parent/'book-memory/reviews/2026-09-13-final-package/v10-0-release-before-install.zip')
    parser.add_argument('--replace-prepared-release',metavar='EXACT_OLD_RELEASE_ID',
                        help='Explicitly replace a failed unpublished 10.1 preparation with identical accepted content; requires a separate private snapshot')
    args=parser.parse_args();stage=args.stage.resolve()
    require(args.replace_prepared_release is None or args.action=='install',
            '--replace-prepared-release is only valid for install')
    if args.action=='source-set':
        items=[{'id':i,**record(args.source,f'manuscript/chapters/{i}.md')} for i in IDS]
        print(json.dumps({'sources':items,'sourceSetSha256':source_set(items)},ensure_ascii=False,indent=2));return
    if args.action=='prepare':prepare(args.source.resolve(),stage,args.acceptance)
    elif args.action=='install':install(stage,args.snapshot.resolve(),args.replace_prepared_release)
    else:verify(stage if (stage/MANIFEST).exists() else ROOT);print('V10.1 exact sources, evidence, documents and public packages verified')
if __name__=='__main__':main()
