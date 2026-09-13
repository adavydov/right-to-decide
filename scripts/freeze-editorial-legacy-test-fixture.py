"""Preserve exact historical test inputs outside the static public tree."""
from pathlib import Path
import json, hashlib

ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'docs/open-editorial/test-fixtures/v9'
def read(p): return json.loads((ROOT/p).read_text(encoding='utf-8-sig'))
book=read('src/data/edition-v9.json')
receipt_path='docs/open-editorial/identity-transitions/'+book['releaseId']+'.json'
receipt=read(receipt_path)
manifest=read(receipt['release_manifest']['path'])
selection=read(receipt['publication_selection']['path'])
paths={receipt_path,'src/data/edition-v9.json'}
for item in [receipt['release_manifest'],receipt['publication_selection'],receipt['previous_identity_map'],receipt['previous_corpus'],receipt['previous_edition'],*selection['inputs'],manifest['prologue'],*manifest['chapters'],*manifest.get('supplements',[]),manifest['authorContents']]:
    paths.add(item['path'])
for p in (ROOT/'public/editorial/editions').rglob('*'):
    if p.is_file(): paths.add(p.relative_to(ROOT).as_posix())
for p in (ROOT/'docs/open-editorial/identity-transitions/archives').rglob('*'):
    if p.is_file(): paths.add(p.relative_to(ROOT).as_posix())
records=[]
for relative in sorted(paths):
    src=ROOT/relative; dest=DEST/relative; raw=src.read_bytes()
    dest.parent.mkdir(parents=True,exist_ok=True)
    if dest.exists(): assert dest.read_bytes()==raw, 'Immutable fixture differs: '+relative
    else: dest.write_bytes(raw)
    records.append({'path':relative,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)})
edition=read('public/editorial/editions/'+book['releaseId']+'/edition.json')
mapping={'schema_version':'1.0','chapters':{c['id']:{'source_sha256':c['source_sha256'],'blocks':{b['dom_id']:b['id'] for b in c['blocks']}} for c in edition['chapters']}}
raw=(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
assert hashlib.sha256(raw).hexdigest()==receipt['next_identity_map_sha256']
(DEST/'docs/open-editorial/block-identities.json').write_bytes(raw)
(DEST/'src/data/book.json').write_bytes((ROOT/'src/data/edition-v9.json').read_bytes())
(DEST/'fixture-manifest.json').write_text(json.dumps({'purpose':'Exact retired public bytes for historical contract tests; never a site export.','releaseId':book['releaseId'],'files':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Frozen {len(records)} historical inputs outside public; {sum(x["bytes"] for x in records)} bytes.')
