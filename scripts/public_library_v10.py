"""Validate an explicit bibliography projection. Never reads the private library."""
import json
import re
from urllib.parse import urlsplit

FIELDS={'id','title','authors','edition','category','annotation','role','cardCount','reading','links'}
PRIVATE=re.compile(r'book-memory|file://|(?<!\w)[A-Za-z]:[\\/]|-----BEGIN [A-Z ]*PRIVATE KEY',re.I)

def validate(data, require):
    require(set(data)=={'schemaVersion','asOf','summary','readingNote','sources'},'Unexpected public library field')
    require(data['schemaVersion']==1 and isinstance(data['sources'],list) and len(data['sources'])>0,'Public bibliography required')
    require(not PRIVATE.search(json.dumps(data,ensure_ascii=False)), 'Private data in public bibliography')
    seen=set()
    for source in data['sources']:
        require(set(source)==FIELDS,'Only bibliography whitelist fields are allowed')
        require(re.fullmatch(r'ref-[0-9]{3,}',source['id']) and source['id'] not in seen,'Unique bibliography ID required')
        seen.add(source['id'])
        for k in ('title','edition','category','annotation','role'):
            require(isinstance(source[k],str) and 0<len(source[k])<=1200 and '<' not in source[k],'Invalid public text: '+k)
        require(isinstance(source['authors'],list) and len(source['authors'])>0 and all(isinstance(a,str) and a for a in source['authors']),'Authors required')
        require(type(source['cardCount']) is int and source['cardCount']>=0,'Invalid card count')
        require(set(source['reading'])=={'kind','label','scope'} and source['reading']['kind'] in ['selected','excerpt','full-document','mixed','alias','catalog'],'Explicit reading scope required')
        require(all(isinstance(v,str) and v for v in source['reading'].values()),'Reading fields must be text')
        for link in source['links']:
            require(set(link)=={'label','url'},'Only source label and URL allowed')
            url=urlsplit(link['url'])
            require(url.scheme in ('https','http') and url.hostname and not url.username and not url.password,'Public source URL required')
    expected={'records':len(seen),'recordsWithCards':sum(s['cardCount']>0 for s in data['sources']),'cards':sum(s['cardCount'] for s in data['sources'])}
    require(data['summary']==expected,'Public bibliography counts differ')
    return data

def collect(source, checked, require):
    path=source/'public/library-v10/manifest.json'
    require(path.is_file(),'Final public bibliography manifest missing')
    manifest=json.loads(path.read_text(encoding='utf-8-sig'))
    require(manifest.get('decision')=='accepted' and manifest.get('reviewer') and manifest['reviewer']!=manifest.get('author'),'Public bibliography requires independent acceptance')
    require(manifest['catalog']['path']=='public/library-v10/catalog.json','Unexpected public catalog path')
    raw=checked(source,manifest['catalog'])
    data=validate(json.loads(raw.decode('utf-8-sig')),require)
    require(manifest['counts']==data['summary'],'Accepted bibliography count mismatch')
    return manifest,{'status':'accepted-public-package',**data},{'public/library/v10/catalog.json':raw}
