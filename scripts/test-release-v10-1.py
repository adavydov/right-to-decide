"""Technical fixtures only: no real acceptance, conversion, install or publication."""
import copy
from io import BytesIO
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import release_v10_1 as release
import public_packages_v10_1 as packages
import chapter_docx_v10
import book_cover_v10

def put(root,path,value):
    target=root/path;target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(value if isinstance(value,bytes) else release.encode(value))
    return release.record(root,path)

def fixture(root, line_ending='\n', ending_suffix='', paragraph='Технический абзац.'):
    plans=[{'id':i,'title':'Формат '+i,'number':n,'part':1 if i.startswith('C') else 0,'part_title':'Техническая проверка'} for n,i in enumerate(release.IDS)]
    metadata={'title':'Техническая книга','subtitle':'Технический подзаголовок','final_sentence':'Технический конец.','epilogue_sentence':'Технический эпилог.'}
    for path in release.POLICIES:
        put(root,path,plans if path.endswith('chapters.json') else metadata if path=='BOOK_METADATA.json' else b'Technical fixture only.')
    authority=put(root,'editorial/AUTHOR_DECISION_2026-09-13_FINAL_PATCH.md',b'Technical authorization fixture, not a user instruction.')
    sources=[]
    for i in release.IDS:
        text='# Формат '+i+'\n\n'+paragraph+'\n'
        if i in ['C24','E00']:text+='\n'+metadata['final_sentence' if i=='C24' else 'epilogue_sentence']+ending_suffix+'\n'
        item={'id':i,**put(root,f'manuscript/chapters/{i}.md',text.replace('\n',line_ending).encode()),'author':'fixture-writer','independentReviewer':'fixture-reader','decision':'accepted','unresolvedMaterialIssues':0}
        item['evidence']=put(root,f'editorial/release-attestations-v10-1/{i}.json',{'schemaVersion':1,'chapter':i,'sourceSha256':item['sha256'],'author':item['author'],'reviewer':item['independentReviewer'],'decision':'accepted','unresolvedMaterialIssues':0})
        sources.append(item)
    digest=release.source_set(sources)
    value={'schemaVersion':1,'editionVersion':'10.1','decision':'accepted-for-release','releaseDate':'2026-09-13','sources':sources,'sourceSetSha256':digest,'policies':[release.record(root,p) for p in release.POLICIES],'wholeBook':{}}
    for scope in release.REVIEW_SCOPES:
        note={'schemaVersion':1,'scope':scope,'sourceSetSha256':digest,'reviewer':'fixture-reader','decision':'accepted','limits':['Technical fixture only.']}
        value['wholeBook'][scope]={'reviewer':'fixture-reader','decision':'accepted','sourceSetSha256':digest,'evidence':put(root,f'editorial/release-attestations-v10-1/{scope}.json',note)}
    note={'schemaVersion':1,'scope':'publication-authorization','decision':'authorized','sourceSetSha256':digest,'meaning':'Technical fixture. No real user instruction or human reading.'}
    value['authorApproval']={'scope':'publication-authorization','reviewer':'user-direct-instruction','decision':'authorized','sourceSetSha256':digest,'authorityEvidence':authority,'evidence':put(root,'editorial/release-attestations-v10-1/publication-authorization.json',note)}
    put(root,'editorial/acceptance-v10-1.json',value)
    return value

def public_fixtures(root):
    def manifest(path,**content):put(root,path,{'schemaVersion':1,'editionVersion':'10.1','decision':'accepted','author':'fixture-writer','reviewer':'fixture-reader',**content})
    texts=[];downloads=[]
    for ident in ['INDEX']+packages.MODELS:
        name='index' if ident=='INDEX' else ident
        texts.append({'id':ident,**put(root,'public/research-v10/'+name+'.md',('# '+ident+'\n\nТехническая запись модели.\n').encode())})
        if ident!='INDEX':downloads.append({'modelId':ident,'name':ident+'.py','label':'Fixture',**put(root,'models/'+ident+'.py',b'# Technical fixture, never executed.\n')})
    manifest('public/research-v10/manifest.json',texts=texts,downloads=downloads)
    source={'id':'ref-001','title':'Источник','authors':['Автор'],'edition':'Техническая запись','category':'Общество','annotation':'Наблюдение','role':'Основание','cardCount':1,'reading':{'kind':'excerpt','label':'Фрагмент','scope':'Техническая fixture, не реальное чтение.'},'links':[],'cards':[{'id':'FIXTURE-C01','title':'Мысль','idea':'Идея','application':'Применение','locator':'Фрагмент'}]}
    cards={'schemaVersion':1,'asOf':'2026-09-13','summary':{'records':1,'recordsWithCards':1,'cards':1},'readingNote':'Технический корпус','cardNote':'Технические карточки','sources':[source]}
    manifest('public/library-v10/manifest.json',cards=put(root,'public/library-source-cards.json',cards),counts=cards['summary'])
    team={'schemaVersion':1,'version':'10.1','updated':'2026-09-13','title':'Редакция','intro':'Техническая fixture','roleNote':'Программные функции','humanDirection':{'title':'Автор','description':'Тест'},'roles':[{'id':i,'name':i,'description':'Техническая роль','libraryThemes':['Общество']} for i in sorted(packages.editorial.IDS)],'workflow':[{'id':'step-'+str(i),'title':'Шаг','description':'Тест','roleIds':['author']} for i in range(4)]}
    manifest('public/editorial-v10/manifest.json',team=put(root,'public/editorial-v10/team.json',team),text=put(root,'public/editorial-v10/team.md','# Редакция\n\nТехническая запись.\n'.encode()),manifesto=put(root,'public/editorial-v10/manifesto.md','# Замысел\n\nТехническая запись.\n'.encode()))
    essence={'schemaVersion':1,'editionVersion':'10.1','title':'Суть','subtitle':'Технический подзаголовок','intro':'Техническая запись','readingMinutes':{'min':30,'max':40,'basis':'Техническая цель'},'parts':[{'id':'one','title':'Часть'}],'steps':[{'id':f'{n:02d}','chapterId':i,'part':'one','title':'Шаг','insight':'Мысль','paragraphs':['Технический абзац.']} for n,i in enumerate(release.IDS,1)]}
    manifest('public/essence-v10-1-manifest.json',content=put(root,'public/essence-v10-1.json',essence))

def fake_documents(book,destination):
    # Only mock the external conversion boundary in temporary test packages.
    for ext in ['pdf','docx']:(destination/('right-to-decide-v10.1.'+ext)).write_bytes(b'TECHNICAL TEST FIXTURE; NOT A DOCUMENT')
    return {'docxVisibleTextExact':True,'pdfVisibleTextInOrder':True,'pdfPages':30,'globalNoteCount':0,'coverSha256':release.sha((release.ROOT/release.COVER).read_bytes()),'pdfCoverFirstPageUnnumbered':True,'pdfTitleOnSecondPage':True,'docxSectionStartsNewPage':True,'pdfSectionStartPages':list(range(3,31))}

class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.base=Path(self.temp.name);self.source=self.base/'source';self.source.mkdir()
        self.value=fixture(self.source)
    def tearDown(self):self.temp.cleanup()
    def save(self):put(self.source,'editorial/acceptance-v10-1.json',self.value)
    def test_28_order_lowercase_urls_and_metadata(self):
        accepted,plans,_=release.acceptance(self.source);book=release.projection(self.source,accepted,plans)
        self.assertEqual(len(book['chapters']),28)
        self.assertEqual([c['id'] for c in book['chapters']][12:14],['chapter-11a','chapter-11b'])
        self.assertEqual(book['subtitle'],'Технический подзаголовок');self.assertEqual(book['statistics']['chapters'],26)
    def test_reject_source_changed_after_acceptance(self):
        p=self.source/'manuscript/chapters/C11A.md';p.write_bytes(p.read_bytes()+b'changed')
        with self.assertRaisesRegex(ValueError,'hash differs'):release.acceptance(self.source)
    def test_reject_old_architecture_even_with_valid_source_set(self):
        self.value['sources']=[x for x in self.value['sources'] if x['id'] not in ['C11A','C11B']];self.value['sourceSetSha256']=release.source_set(self.value['sources']);self.save()
        with self.assertRaisesRegex(ValueError,'28 ordered'):release.acceptance(self.source)
    def test_reject_own_chapter_acceptance(self):
        self.value['sources'][0]['independentReviewer']='fixture-writer';self.save()
        with self.assertRaisesRegex(ValueError,'Independent chapter'):release.acceptance(self.source)
    def test_reject_attestation_with_other_source_hash(self):
        item=self.value['sources'][0];d=release.read(self.source/item['evidence']['path']);d['sourceSha256']='0'*64
        item['evidence']=put(self.source,item['evidence']['path'],d);self.save()
        with self.assertRaisesRegex(ValueError,'different bytes'):release.acceptance(self.source)
    def test_reject_private_fields_even_when_rehashed(self):
        item=self.value['sources'][0];d=release.read(self.source/item['evidence']['path']);d['privateDossier']='working/P00/evidence.md'
        item['evidence']=put(self.source,item['evidence']['path'],d);self.save()
        with self.assertRaisesRegex(ValueError,'Unreviewed fields'):release.acceptance(self.source)
    def test_author_authorization_is_not_human_reading(self):
        self.value['authorApproval']['decision']='accepted';self.save()
        with self.assertRaisesRegex(ValueError,'human reading'):release.acceptance(self.source)
    def test_metadata_and_exact_final_are_pinned(self):
        put(self.source,'BOOK_METADATA.json',{'title':'Changed'})
        with self.assertRaisesRegex(ValueError,'hash differs'):release.acceptance(self.source)
    def test_windows_and_cr_endings_match_without_rewriting_accepted_source_bytes(self):
        for line_ending in ['\r\n','\r']:
            with self.subTest(line_ending=repr(line_ending)):
                self.value=fixture(self.source,line_ending)
                before={item['path']:(self.source/item['path']).read_bytes() for item in self.value['sources']}
                accepted,plans,_=release.acceptance(self.source)
                book=release.projection(self.source,accepted,plans)
                for ident,ending in [('chapter-24','Технический конец.'),('epilogue','Технический эпилог.')]:
                    chapter=next(chapter for chapter in book['chapters'] if chapter['id']==ident)
                    self.assertEqual(chapter['blocks'][-1]['text'],ending)
                self.assertEqual(before,{path:(self.source/path).read_bytes() for path in before})
                self.assertTrue(all(line_ending.encode() in raw for raw in before.values()))
    def test_rehashed_windows_source_with_changed_final_sentence_still_fails(self):
        self.value=fixture(self.source,'\r\n',' Изменённое окончание.')
        with self.assertRaisesRegex(ValueError,'Exact author ending differs'):
            release.acceptance(self.source)
    def test_missing_acceptance_precedes_stage_creation(self):
        target=self.base/'absent';stage=release.ROOT/'.release-staging/fixture-must-not-exist'
        with self.assertRaisesRegex(ValueError,'missing'):release.prepare(target,stage,'editorial/acceptance-v10-1.json')
        self.assertFalse(stage.exists())
    def test_path_escape_rejected(self):
        for path in ['../private','/tmp/file','C:/private','c:private','C:','//server/share/private','a/../../private','a\\b']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                release.local(self.source,path)
    def test_cover_new_aspect_ratio_and_original_png(self):
        png=(release.ROOT/release.COVER).read_bytes();width,height=struct.unpack('>II',png[16:24]);self.assertEqual((width,height),(1024,1536))
        chapter={'id':'fixture','title':'Тест','version':'10.1','blocks':[{'id':'p','type':'paragraph','text':'Технический абзац'}]}
        raw=book_cover_v10.prepend(chapter_docx_v10.build(chapter,[]),png)
        with ZipFile(BytesIO(raw)) as z:
            self.assertEqual(z.read(book_cover_v10.MEDIA),png)
            xml=ET.fromstring(z.read('word/document.xml'));extent=xml.find('.//{'+book_cover_v10.WP+'}extent')
            self.assertAlmostEqual(int(extent.get('cx'))/int(extent.get('cy')),width/height,places=6)
    def test_pdf_footer_never_hides_body_number_or_extra_text(self):
        from pypdf import PdfWriter
        from pypdf.generic import DecodedStreamObject,DictionaryObject,NameObject
        page=PdfWriter().add_blank_page(width=595.3,height=841.9)
        font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
        page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
        raw=b'/Artifact BMC q BT /F1 12 Tf 294.45 41.089 Td (2) Tj ET Q EMC\n/P BMC q BT /F1 12 Tf 68 720 Td (2) Tj 0 -20 Td (Body X) Tj ET Q EMC'
        content=DecodedStreamObject();content.set_data(raw);page[NameObject('/Contents')]=content
        body=release.pdf_body_page(page,2);release.verify_pdf_visible_text([body],['2','Body X'])
        with self.assertRaises(ValueError):release.verify_pdf_visible_text([body],['2','Body'])
        self.assertEqual(page.get_contents().get_data(),raw)
    def test_public_packages_need_independent_acceptance_and_actual_counts(self):
        public_fixtures(self.source);release.public_packages(self.source)
        cards=release.read(self.source/'public/library-source-cards.json');cards['summary']['cards']=2
        with self.assertRaises(ValueError):packages.validate_library(cards,release.require)
        cards['summary']['cards']=1;cards['sources'][0]['cards'][0]['privatePath']='C:/private'
        with self.assertRaises(ValueError):packages.validate_library(cards,release.require)
        manifest=release.read(self.source/'public/research-v10/manifest.json');manifest['reviewer']=manifest['author'];put(self.source,'public/research-v10/manifest.json',manifest)
        with self.assertRaisesRegex(ValueError,'Independent'):release.public_packages(self.source)
    def test_public_library_projection_bytes_are_identical_across_hash_seeds(self):
        public_fixtures(self.source)
        code=('from pathlib import Path; import sys; import release_v10_1 as r; '
              'import public_packages_v10_1 as p; '
              'value=p.collect_library(Path(sys.argv[1]),r.checked,r.require); '
              'sys.stdout.buffer.write(r.encode([value[0],value[1],{k:v.hex() for k,v in value[2].items()}]))')
        outputs=[]
        for seed in ['1','42','314159']:
            environment={**os.environ,'PYTHONHASHSEED':seed,'PYTHONIOENCODING':'utf-8'}
            outputs.append(subprocess.check_output([sys.executable,'-c',code,str(self.source)],
                           cwd=Path(__file__).resolve().parent,env=environment,timeout=30))
        self.assertEqual(outputs[0],outputs[1],'Library projection differs with another process hash seed')
        self.assertEqual(outputs[0],outputs[2],'Library projection must reproduce exact accepted JSON bytes')
    def test_rebuild_rejects_tampered_public_projection_and_undeclared_files(self):
        public_fixtures(self.source);repo=self.base/'repo';repo.mkdir()
        for path in release.GENERATOR_FILES+['scripts/public_packages_v10_1.py','scripts/public_library_v10.py','scripts/public_editorial_v10.py','scripts/book_cover_v10.py',release.COVER]:put(repo,path,b'Technical generator/cover fixture')
        stage=repo/'.release-staging/fixture'
        with patch.object(release,'ROOT',repo),patch.object(release,'documents',fake_documents):
            release.prepare(self.source,stage,'editorial/acceptance-v10-1.json');release.verify(stage)
            file=stage/'src/data/library-v10.json';raw=file.read_bytes();data=release.read(file);data['sources'][0]['annotation']='Changed projection';file.write_bytes(release.encode(data))
            manifest=release.read(stage/release.MANIFEST)
            manifest['artifacts']=[release.record(stage,x['path']) if x['path']=='src/data/library-v10.json' else x for x in manifest['artifacts']];put(stage,release.MANIFEST,manifest)
            with self.assertRaisesRegex(ValueError,'projection differs'):release.verify(stage)
            file.write_bytes(raw);manifest['artifacts']=[release.record(stage,x['path']) if x['path']=='src/data/library-v10.json' else x for x in manifest['artifacts']]
            manifest['artifacts'].append(put(stage,'manuscript/v10-1/extra-private.json',b'{}'));put(stage,release.MANIFEST,manifest)
            with self.assertRaisesRegex(ValueError,'undeclared files'):release.verify(stage)
    def test_snapshot_crc_exact_bytes_and_reject_overwrite(self):
        repo=self.base/'repo';repo.mkdir();put(repo,'src/data/book.json',b'OLD BYTES\r\n');snapshot=self.base/'history/snapshot.zip'
        with patch.object(release,'ROOT',repo):
            release.snapshot_transition({'src/data/book.json'},snapshot,{'editionVersion':'10.0','releaseId':'fixture'})
            with ZipFile(snapshot) as z:self.assertEqual(z.read('src/data/book.json'),b'OLD BYTES\r\n');self.assertIsNone(z.testzip())
            put(repo,'src/data/book.json',b'Changed')
            with self.assertRaisesRegex(ValueError,'snapshot differs'):release.snapshot_transition({'src/data/book.json'},snapshot,{'editionVersion':'10.0','releaseId':'fixture'})
    def test_essence_rejects_duplicate_29th_step(self):
        public_fixtures(self.source);data=release.read(self.source/'public/essence-v10-1.json')
        data['steps'].append({**data['steps'][0],'id':'29'})
        with self.assertRaisesRegex(ValueError,'28 ordered'):packages.validate_essence(data,release.require)
    def test_essence_rejects_misordered_chapters_and_step_ids(self):
        public_fixtures(self.source);data=release.read(self.source/'public/essence-v10-1.json')
        data['steps'][0],data['steps'][1]=data['steps'][1],data['steps'][0]
        with self.assertRaisesRegex(ValueError,'28 ordered'):packages.validate_essence(data,release.require)
        data['steps'][0],data['steps'][1]=data['steps'][1],data['steps'][0];data['steps'][0]['id']='wrong'
        with self.assertRaisesRegex(ValueError,'01 through 28'):packages.validate_essence(data,release.require)
    def test_essence_rejects_malformed_fork_and_empty_step_text(self):
        public_fixtures(self.source);data=release.read(self.source/'public/essence-v10-1.json')
        fork={'question':'Выбор?','options':[{'title':'А','outcome':'Первый исход'},{'title':'Б','outcome':'Второй исход'}]}
        data['steps'][0]['fork']=fork;packages.validate_essence(data,release.require)
        for malformed in [{'question':'Вопрос','options':[fork['options'][0]]},{'question':'<script>','options':fork['options']},{'question':'Вопрос','options':[{'title':'А','outcome':''},fork['options'][1]]}]:
            data['steps'][0]['fork']=malformed
            with self.assertRaises(ValueError):packages.validate_essence(data,release.require)
        data['steps'][0]['fork']=fork;data['steps'][0]['insight']=' '
        with self.assertRaisesRegex(ValueError,'nonempty'):packages.validate_essence(data,release.require)
    def test_install_10_0_transition_needs_no_public_v9_and_keeps_snapshot(self):
        public_fixtures(self.source);repo=self.base/'repo';repo.mkdir()
        for path in release.GENERATOR_FILES+['scripts/public_packages_v10_1.py','scripts/public_library_v10.py','scripts/public_editorial_v10.py','scripts/book_cover_v10.py',release.COVER]:put(repo,path,b'Technical generator/cover fixture')
        old=release.encode({'editionVersion':'10.0','releaseId':'old-technical-fixture'})
        put(repo,'src/data/book.json',old);put(repo,'manuscript/v10/release-manifest.json',{'bookSha256':release.sha(old)})
        stage=repo/'.release-staging/fixture';snapshot=self.base/'private/snapshot.zip'
        with patch.object(release,'ROOT',repo),patch.object(release,'documents',fake_documents):
            release.prepare(self.source,stage,'editorial/acceptance-v10-1.json')
            release.install(stage,snapshot);release.verify(repo)
            with ZipFile(snapshot) as z:self.assertEqual(z.read('src/data/book.json'),old)
            self.assertFalse((repo/'src/data/edition-v9.json').exists())
            release.install(stage,snapshot)  # exact reinstall is harmless
            put(repo,'src/data/book.json',{'editionVersion':'9.0'})
            with self.assertRaisesRegex(ValueError,'10.0 to 10.1'):release.install(stage,snapshot)

    def replacement_fixture(self, change=None):
        # Every preparation/install here targets a fresh temporary technical repo.
        self.value=fixture(self.source);public_fixtures(self.source)
        repo=self.base/('replacement-'+str(len(list(self.base.glob('replacement-*')))));repo.mkdir()
        for path in release.GENERATOR_FILES+['scripts/public_packages_v10_1.py','scripts/public_library_v10.py','scripts/public_editorial_v10.py','scripts/book_cover_v10.py',release.COVER]:
            put(repo,path,b'Technical generator/cover fixture')
        self.enterContext(patch.object(release,'ROOT',repo))
        self.enterContext(patch.object(release,'documents',fake_documents))
        old_book=release.encode({'editionVersion':'10.0','releaseId':'old-technical-fixture'})
        put(repo,'src/data/book.json',old_book)
        put(repo,'manuscript/v10/release-manifest.json',{'bookSha256':release.sha(old_book)})
        original=repo/'.release-staging/original'
        release.prepare(self.source,original,'editorial/acceptance-v10-1.json')
        release.install(original,self.base/(repo.name+'-10.0.zip'))
        previous=release.read(repo/release.MANIFEST)
        put(repo,release.GENERATOR_FILES[0],b'Repaired technical generator fixture')
        if change=='source':
            self.value=fixture(self.source,paragraph='Другой принятый технический абзац.')
        elif change=='acceptance':
            self.value['releaseDate']='2026-09-14';self.save()
        elif change=='public':
            cards=release.read(self.source/'public/library-source-cards.json')
            cards['sources'][0]['annotation']='Другой принятый комментарий.'
            receipt=release.read(self.source/'public/library-v10/manifest.json')
            receipt['cards']=put(self.source,'public/library-source-cards.json',cards)
            put(self.source,'public/library-v10/manifest.json',receipt)
        stage=repo/'.release-staging/repaired'
        release.prepare(self.source,stage,'editorial/acceptance-v10-1.json')
        snapshot=self.base/(repo.name+'-10.1.zip')
        return repo,stage,snapshot,previous

    def test_prepared_replacement_preserves_content_and_snapshots_exact_previous_package(self):
        repo,stage,snapshot,old=self.replacement_fixture()
        before={item['path']:(repo/item['path']).read_bytes() for item in old['artifacts']}
        before[release.MANIFEST]=(repo/release.MANIFEST).read_bytes()
        # The ordinary verifier remains strict after current generator repair.
        with self.assertRaisesRegex(ValueError,'hash differs'):release.verify(repo)
        release.install(stage,snapshot,old['releaseId'])
        new=release.verify(repo)
        self.assertNotEqual(old['releaseId'],new['releaseId'])
        self.assertEqual(old['sourceSetSha256'],new['sourceSetSha256'])
        with ZipFile(snapshot) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(json.loads(archive.read('snapshot.json'))['fromReleaseId'],old['releaseId'])
            for path,raw in before.items():self.assertEqual(archive.read(path),raw,path)
        for item in old['sources']+old['evidence']:
            self.assertEqual((repo/item['path']).read_bytes(),before[item['path']])

    def test_prepared_replacement_requires_explicit_exact_old_id_before_mutation(self):
        repo,stage,snapshot,old=self.replacement_fixture()
        before=(repo/'src/data/book.json').read_bytes()
        for expected in [None,'literary-manuscript-v10.1-wrong',release.read(stage/release.MANIFEST)['releaseId']]:
            with self.subTest(expected=expected),self.assertRaises(ValueError):
                release.install(stage,snapshot,expected)
            self.assertFalse(snapshot.exists())
            self.assertEqual((repo/'src/data/book.json').read_bytes(),before)

    def test_prepared_replacement_rejects_published_or_nonprepared_record(self):
        repo,stage,snapshot,old=self.replacement_fixture()
        for field,value in [('published',True),('status','published')]:
            changed={**old,field:value};put(repo,release.MANIFEST,changed)
            with self.subTest(field=field),self.assertRaisesRegex(ValueError,'unpublished preparation'):
                release.install(stage,snapshot,old['releaseId'])
            self.assertFalse(snapshot.exists())
        put(repo,release.MANIFEST,old)

    def test_prepared_replacement_rejects_tampered_previous_artifacts_and_generator_identity(self):
        repo,stage,snapshot,old=self.replacement_fixture()
        for path in ['src/data/book.json',old['sources'][0]['path'],old['evidence'][0]['path'],'public/book/right-to-decide-v10.1.pdf']:
            target=repo/path;raw=target.read_bytes();target.write_bytes(raw+b' ')
            with self.subTest(path=path),self.assertRaises(ValueError):
                release.install(stage,snapshot,old['releaseId'])
            target.write_bytes(raw)
            self.assertFalse(snapshot.exists())
        tampered=copy.deepcopy(old);tampered['generators'][0]['sha256']='0'*64
        put(repo,release.MANIFEST,tampered)
        with self.assertRaisesRegex(ValueError,'Release identity differs'):
            release.install(stage,snapshot,old['releaseId'])
        self.assertFalse(snapshot.exists())

    def test_prepared_replacement_rejects_newly_accepted_content_or_receipts(self):
        for change,message in [('source','accepted source set'),('acceptance','exact acceptance bytes'),('public','exact public receipts')]:
            with self.subTest(change=change):
                repo,stage,snapshot,old=self.replacement_fixture(change)
                before=(repo/release.MANIFEST).read_bytes()
                release.verify(stage)  # The incoming package is valid, but outside technical replacement scope.
                with self.assertRaisesRegex(ValueError,message):release.install(stage,snapshot,old['releaseId'])
                self.assertFalse(snapshot.exists())
                self.assertEqual((repo/release.MANIFEST).read_bytes(),before)

    def test_prepared_replacement_restores_all_previous_bytes_after_install_failure(self):
        repo,stage,snapshot,old=self.replacement_fixture()
        before={item['path']:(repo/item['path']).read_bytes() for item in old['artifacts']}
        before[release.MANIFEST]=(repo/release.MANIFEST).read_bytes()
        real_verify=release.verify
        def fail_installed(base):
            if base==repo:raise ValueError('Simulated final verification failure')
            return real_verify(base)
        with patch.object(release,'verify',side_effect=fail_installed),self.assertRaisesRegex(ValueError,'Simulated final'):
            release.install(stage,snapshot,old['releaseId'])
        self.assertTrue(snapshot.exists())
        for path,raw in before.items():self.assertEqual((repo/path).read_bytes(),raw,path)

if __name__=='__main__':unittest.main()
