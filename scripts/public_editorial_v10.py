"""Accepted public projection of 13 v10 literary functions; no private roster reads."""
import json,re
import manuscript_v10
from public_library_v10 import PRIVATE
IDS={'alternative-designer','author','history-of-ideas','human-change','integrator','literary-editor','machine-institutions','material-space','political-economy','production-power','publisher','reader','source-editor'}
FIELDS={'schemaVersion','version','updated','title','intro','roleNote','humanDirection','roles','workflow'}
def validate(data,require):
    require(set(data)==FIELDS and data['schemaVersion']==1 and data['version']=='10.0','Unexpected editorial projection')
    require(not PRIVATE.search(json.dumps(data,ensure_ascii=False)),'Private path in public editorial text')
    require(re.fullmatch(r'\d{4}-\d{2}-\d{2}',data['updated']),'Editorial date required')
    for k in ['title','intro','roleNote']:require(isinstance(data[k],str) and data[k] and '<' not in data[k],'Invalid editorial text')
    require(set(data['humanDirection'])=={'title','description'},'Human direction has unexpected fields')
    require(len(data['roles'])==13 and {r['id'] for r in data['roles']}==IDS,'Exactly 13 distinct literary roles required')
    for role in data['roles']:
        require(set(role)=={'id','name','description','libraryThemes'},'Only public role fields allowed')
        require(all(isinstance(role[k],str) and role[k] for k in ['id','name','description']),'Role text missing')
        require(isinstance(role['libraryThemes'],list) and all(isinstance(t,str) and t for t in role['libraryThemes']),'Invalid thematic links')
    seen=set()
    for step in data['workflow']:
        require(set(step)=={'id','title','description','roleIds'} and step['id'] not in seen,'Unique workflow step required')
        seen.add(step['id'])
        require(re.fullmatch(r'[a-z][a-z0-9-]*',step['id']),'Safe workflow identifier required')
        require(step['title'] and step['description'] and step['roleIds'] and all(i in IDS for i in step['roleIds']),'Workflow must reference actual roles')
    require(len(seen)>=4,'Research, writing, independent reading and integration must be explicit')
    return data

def collect(source,checked,require):
    path=source/'public/editorial-v10/manifest.json'
    require(path.is_file(),'Final public editorial package missing')
    manifest=json.loads(path.read_text(encoding='utf-8-sig'))
    require(manifest.get('decision')=='accepted' and manifest.get('reviewer') and manifest['reviewer']!=manifest.get('author'),'Public editorial package requires independent acceptance')
    require(manifest['team']['path']=='public/editorial-v10/team.json' and manifest['text']['path']=='public/editorial-v10/team.md' and manifest['manifesto']['path']=='public/editorial-v10/manifesto.md','Unexpected public editorial paths')
    raw=checked(source,manifest['team']);data=validate(json.loads(raw.decode('utf-8-sig')),require)
    text=checked(source,manifest['text']);require(not PRIVATE.search(text.decode('utf-8-sig')),'Private path in editorial text')
    manuscript_v10.parse(text,'public-editorial-v10')
    manifesto=checked(source,manifest['manifesto']);require(not PRIVATE.search(manifesto.decode('utf-8-sig')),'Private path in public manifesto')
    title,blocks,notes,_=manuscript_v10.parse(manifesto,'public-manifesto-v10')
    projection={'status':'accepted-public-package','title':title,'blocks':blocks,'notes':notes}
    encoded=(json.dumps(projection,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    return manifest,{'status':'accepted-public-package',**data},{'public/editorial/v10/team.json':raw,'public/editorial/v10/team.md':text,'public/manifesto/v10/manifesto.md':manifesto,'src/data/manifesto-v10.json':encoded}
