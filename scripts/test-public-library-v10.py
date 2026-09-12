"""Technical metadata fixtures only; no manuscript or source corpus."""
import copy,json,tempfile,unittest
from pathlib import Path
import public_library_v10 as library
import release_v10 as release

def fixture():
    return {'schemaVersion':1,'asOf':'2026-09-12','summary':{'records':1,'recordsWithCards':1,'cards':1},'readingNote':'Technical fixture, no source reading claimed.',
        'sources':[{'id':'ref-001','title':'Technical fixture','authors':['Fixture author'],'edition':'Fixture only','category':'Fixture','annotation':'No book content.','role':'Test','cardCount':1,
            'reading':{'kind':'selected','label':'Fixture','scope':'No real source.'},'links':[{'label':'Example','url':'https://example.org/'}]}]}

def install_fixture(root,decision='accepted',reviewer='fixture-reader'):
    p=root/'public/library-v10';p.mkdir(parents=True)
    (p/'catalog.json').write_bytes(release.encode(fixture()))
    manifest={'decision':decision,'author':'fixture-author','reviewer':reviewer,'counts':fixture()['summary'],'catalog':release.record(root,'public/library-v10/catalog.json')}
    (p/'manifest.json').write_bytes(release.encode(manifest))

class PublicLibraryTests(unittest.TestCase):
    def test_projection_uses_exact_allowlist(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);install_fixture(root)
            manifest,data,outputs=library.collect(root,release.checked,release.require)
            self.assertEqual(data['status'],'accepted-public-package')
            self.assertEqual(set(outputs),{'public/library/v10/catalog.json'})
            self.assertEqual(json.loads(next(iter(outputs.values()))),fixture())
    def test_draft_and_self_acceptance_rejected(self):
        for decision,reviewer in [('draft','fixture-reader'),('accepted','fixture-author')]:
            with self.subTest(decision=decision),tempfile.TemporaryDirectory() as d:
                root=Path(d);install_fixture(root,decision,reviewer)
                with self.assertRaises(ValueError):library.collect(root,release.checked,release.require)
    def test_private_fields_paths_and_nonpublic_links_rejected(self):
        for mode in ['extra','path','url']:
            data=copy.deepcopy(fixture())
            if mode=='extra':data['sources'][0]['source_refs']=['private']
            elif mode=='path':data['sources'][0]['annotation']='book-memory/books/private'
            else:data['sources'][0]['links'][0]['url']='file:///secret'
            with self.subTest(mode=mode),self.assertRaises(ValueError):library.validate(data,release.require)
    def test_tampered_catalog_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);install_fixture(root)
            p=root/'public/library-v10/catalog.json';p.write_bytes(p.read_bytes()+b' ')
            with self.assertRaises(ValueError):library.collect(root,release.checked,release.require)
    def test_duplicate_ids_and_false_counts_rejected(self):
        for mode in ['duplicate','count']:
            data=copy.deepcopy(fixture())
            if mode=='duplicate':data['sources'].append(copy.deepcopy(data['sources'][0]))
            else:data['summary']['cards']=2
            with self.subTest(mode=mode),self.assertRaises(ValueError):library.validate(data,release.require)

if __name__=='__main__':unittest.main()
