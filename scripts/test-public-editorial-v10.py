"""Disposable technical role metadata; no real editorial acceptance."""
import copy,tempfile,unittest
from pathlib import Path
import public_editorial_v10 as editorial
import release_v10 as release
def fixture():
    return {'schemaVersion':1,'version':'10.0','updated':'2026-09-12','title':'Technical fixture','intro':'No real team acceptance.','roleNote':'Virtual fixture roles.','humanDirection':{'title':'Fixture','description':'Test only.'},
        'roles':[{'id':i,'name':'Fixture '+i,'description':'Technical function only.','libraryThemes':[]} for i in sorted(editorial.IDS)],
        'workflow':[{'id':i,'title':'Fixture '+i,'description':'Test only.','roleIds':[role]} for i,role in [('research','source-editor'),('write','author'),('read','reader'),('integrate','integrator')]]}
def install_fixture(root,decision='accepted',reviewer='fixture-reader'):
    p=root/'public/editorial-v10';p.mkdir(parents=True)
    (p/'team.json').write_bytes(release.encode(fixture()));(p/'team.md').write_bytes(b'# Technical fixture\n\nNo real team acceptance.\n');(p/'manifesto.md').write_bytes(b'# Technical manifesto fixture\n\nNo real manifesto acceptance.\n')
    (p/'manifest.json').write_bytes(release.encode({'decision':decision,'author':'fixture-author','reviewer':reviewer,
        'team':release.record(root,'public/editorial-v10/team.json'),'text':release.record(root,'public/editorial-v10/team.md'),'manifesto':release.record(root,'public/editorial-v10/manifesto.md')}))
class EditorialTests(unittest.TestCase):
    def test_exact_public_projection(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);install_fixture(root);_,data,outputs=editorial.collect(root,release.checked,release.require)
            self.assertEqual(len(data['roles']),13);self.assertEqual(set(outputs),{'public/editorial/v10/team.json','public/editorial/v10/team.md','public/manifesto/v10/manifesto.md','src/data/manifesto-v10.json'})
    def test_pending_or_self_acceptance_rejected(self):
        for decision,reviewer in [('draft','fixture-reader'),('accepted','fixture-author')]:
            with tempfile.TemporaryDirectory() as d:
                root=Path(d);install_fixture(root,decision,reviewer)
                with self.assertRaises(ValueError):editorial.collect(root,release.checked,release.require)
    def test_private_fields_wrong_role_and_missing_workflow_rejected(self):
        for mode in ['private','role','workflow','field']:
            data=copy.deepcopy(fixture())
            if mode=='private':data['intro']='book-memory/secret'
            if mode=='role':data['roles'][0]['id']='unknown'
            if mode=='workflow':data['workflow']=[]
            if mode=='field':data['roles'][0]['cards']=['private-card']
            with self.subTest(mode=mode),self.assertRaises(ValueError):editorial.validate(data,release.require)
    def test_hash_change_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);install_fixture(root);p=root/'public/editorial-v10/team.md';p.write_bytes(p.read_bytes()+b'changed')
            with self.assertRaises(ValueError):editorial.collect(root,release.checked,release.require)
if __name__=='__main__':unittest.main()
