"""Read only independently accepted public projections; never the private library."""
import copy
import json
import re
from urllib.parse import urlsplit
import manuscript_v10
import public_library_v10 as bibliography
import public_editorial_v10 as editorial

VERSION = '10.1'
MODELS = ['M01', 'M02', 'M03', 'M04', 'M05']
IDS = ['P00'] + [f'C{i:02d}' for i in range(1, 12)] + ['C11A', 'C11B'] + [f'C{i:02d}' for i in range(12, 25)] + ['E00']
PRIVATE = re.compile(r'book-memory|file://|(?<!\w)[A-Za-z]:[\\/]|-----BEGIN [A-Z ]*PRIVATE KEY', re.I)

def encode(value): return (json.dumps(value, ensure_ascii=False, indent=2)+'\n').encode('utf-8')

def public_text(raw, require):
    text = raw.decode('utf-8-sig')
    require(not PRIVATE.search(text), 'Private path or key in public package')
    return text

def accepted(source, path, require):
    file = source/path
    require(file.is_file(), 'Accepted public package missing: '+path)
    data = json.loads(file.read_text(encoding='utf-8-sig'))
    require(data.get('schemaVersion') == 1 and data.get('editionVersion') == VERSION, 'Public package must name edition 10.1')
    require(data.get('decision') == 'accepted' and data.get('author') and data.get('reviewer') and data['author'] != data['reviewer'], 'Independent public package acceptance required')
    return data

def receipt(manifest, **records):
    # Internal review paths and previous private manifests are not public evidence.
    return {k:manifest[k] for k in ['schemaVersion','editionVersion','decision','author','reviewer']} | records

def validate_library(data, require):
    require(set(data) == {'schemaVersion','asOf','summary','readingNote','cardNote','sources'}, 'Unexpected public card catalog fields')
    require(data['schemaVersion'] == 1 and isinstance(data['cardNote'],str) and data['cardNote'], 'Public card scope required')
    public_text(encode(data),require)
    stripped={k:v for k,v in data.items() if k!='cardNote'}
    stripped['sources']=[]
    seen=set()
    for source in data['sources']:
        require(set(source) in (bibliography.FIELDS | {'cards'}, bibliography.FIELDS | {'cards','sourceNote'}), 'Unexpected source fields')
        require(isinstance(source['cards'],list) and source['cardCount']==len(source['cards']), 'Card count differs from actual cards')
        if 'sourceNote' in source: require(isinstance(source['sourceNote'],str) and source['sourceNote'], 'Invalid source note')
        for card in source['cards']:
            required={'id','title','idea','application','locator'}
            require(required <= set(card) <= required | {'mechanism','limits','quote'}, 'Unexpected public card fields')
            require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*',card['id']) and card['id'] not in seen, 'Duplicate or unsafe public card ID')
            seen.add(card['id'])
            for key in required | ({'mechanism'} if 'mechanism' in card else set()):
                require(isinstance(card[key],str) and card[key] and '<' not in card[key], 'Invalid card text: '+key)
            if 'limits' in card: require(isinstance(card['limits'],list) and all(isinstance(x,str) and x for x in card['limits']), 'Invalid card limits')
            if 'quote' in card:
                require(set(card['quote'])=={'text','attribution','locator'} and all(isinstance(x,str) and x for x in card['quote'].values()), 'Quote requires attribution and locator')
        stripped['sources'].append({k:source[k] for k in sorted(bibliography.FIELDS)})
    bibliography.validate(stripped,require)
    require(data['summary']['cards']==len(seen), 'Catalog summary differs from unique cards')
    return stripped

def collect_library(source, checked, require):
    manifest=accepted(source,'public/library-v10/manifest.json',require)
    require(manifest['cards']['path']=='public/library-source-cards.json','Unexpected public cards path')
    raw=checked(source,manifest['cards']);data=json.loads(public_text(raw,require))
    stripped=validate_library(data,require)
    require(manifest['counts']==data['summary'],'Accepted public card counts differ')
    result={'status':'accepted-public-package',**stripped}
    return receipt(manifest,cards=manifest['cards'],counts=manifest['counts']), result, {
        'src/data/library-source-cards.json':raw,
        'public/library/v10/catalog.json':encode(stripped),
        'public/library/v10/source-cards.json':raw,
    }

def collect_dossiers(source, checked, require):
    manifest=accepted(source,'public/research-v10/manifest.json',require)
    require([x['id'] for x in manifest['texts']]==['INDEX']+MODELS,'INDEX and M01-M05 dossiers required')
    data={'editionVersion':VERSION,'status':'accepted-public-package','models':[]};outputs={}
    for item in manifest['texts']:
        name='index' if item['id']=='INDEX' else item['id']
        require(item['path']=='public/research-v10/'+name+'.md','Unexpected dossier path')
        raw=checked(source,item);public_text(raw,require)
        title,blocks,notes,_=manuscript_v10.parse(raw,'research-'+item['id'])
        section={'id':item['id'],'title':title,'blocks':blocks,'notes':notes,'downloads':[]}
        if item['id']=='INDEX':data.update({k:v for k,v in section.items() if k not in ['id','downloads']})
        else:data['models'].append(section)
        outputs['public/research/v10/'+name+'.md']=raw
    seen=set()
    for item in manifest.get('downloads',[]):
        require(item['modelId'] in MODELS and item.get('label'),'Model download requires its model and label')
        require(item['path'].startswith('models/'),'Only specified model files may be published')
        require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:py|csv|json|md)',item['name']) and item['name'] not in seen,'Unsafe or duplicate model download')
        seen.add(item['name']);raw=checked(source,item);public_text(raw,require)
        url='/research/v10/files/'+item['name'];outputs['public'+url]=raw
        next(x for x in data['models'] if x['id']==item['modelId'])['downloads'].append({'name':item['name'],'label':item['label'],'path':url})
    require({x['modelId'] for x in manifest.get('downloads',[])}==set(MODELS),'Each model must expose its reviewed reproduction files')
    return receipt(manifest,texts=manifest['texts'],downloads=manifest['downloads']),data,outputs

def collect_editorial(source, checked, require):
    manifest=accepted(source,'public/editorial-v10/manifest.json',require)
    for key,name in [('team','team.json'),('text','team.md'),('manifesto','manifesto.md')]:
        require(manifest[key]['path']=='public/editorial-v10/'+name,'Unexpected public editorial path')
    raw=checked(source,manifest['team']);data=json.loads(public_text(raw,require))
    require(data.get('version')==VERSION,'Editorial team must describe version 10.1')
    # Reuse the exact 13-role whitelist without modifying its frozen validator.
    legacy=copy.deepcopy(data);legacy['version']='10.0';editorial.validate(legacy,require)
    prose=checked(source,manifest['text']);public_text(prose,require);manuscript_v10.parse(prose,'public-editorial-v10-1')
    manifesto=checked(source,manifest['manifesto']);public_text(manifesto,require)
    title,blocks,notes,_=manuscript_v10.parse(manifesto,'public-manifesto-v10-1')
    projection={'status':'accepted-public-package','editionVersion':VERSION,'title':title,'blocks':blocks,'notes':notes}
    return receipt(manifest,**{k:manifest[k] for k in ['team','text','manifesto']}),{'status':'accepted-public-package',**data},{
        'public/editorial/v10/team.json':raw,'public/editorial/v10/team.md':prose,
        'public/manifesto/v10/manifesto.md':manifesto,'src/data/manifesto-v10.json':encode(projection),
    }

def validate_essence(data, require):
    require(set(data)=={'schemaVersion','editionVersion','title','subtitle','intro','readingMinutes','parts','steps'},'Unexpected essence fields')
    require(data['schemaVersion']==1 and data['editionVersion']==VERSION,'Wrong essence edition')
    public_text(encode(data),require)
    require(set(data['readingMinutes'])=={'min','max','basis'} and 0<data['readingMinutes']['min']<=data['readingMinutes']['max'],'Invalid reading-time statement')
    parts={x['id'] for x in data['parts']}
    require(len(parts)==len(data['parts']) and all(set(x)=={'id','title'} for x in data['parts']),'Distinct essence parts required')
    plain=lambda value:isinstance(value,str) and bool(value.strip()) and '<' not in value
    require(len(data['steps'])==28 and [x.get('chapterId') for x in data['steps']]==IDS,'Essence must follow exactly 28 ordered chapters')
    require([x.get('id') for x in data['steps']]==[f'{i:02d}' for i in range(1,29)],'Essence step IDs must be 01 through 28')
    seen=set();chapters=set()
    for step in data['steps']:
        fields={'id','part','chapterId','title','insight','paragraphs'}
        require(fields<=set(step)<=fields|{'fork'},'Unexpected essence step fields')
        require(all(plain(step[k]) for k in fields-{'paragraphs'}),'Essence step text must be nonempty plain text')
        require(step['id'] not in seen and step['part'] in parts and step['chapterId'] in IDS,'Invalid essence cross-reference')
        seen.add(step['id']);chapters.add(step['chapterId'])
        require(isinstance(step['paragraphs'],list) and step['paragraphs'] and all(plain(x) for x in step['paragraphs']),'Essence paragraphs required')
        if 'fork' in step:
            fork=step['fork']
            require(isinstance(fork,dict) and set(fork)=={'question','options'} and plain(fork['question']),'Essence fork requires a plain question')
            require(isinstance(fork['options'],list) and 2<=len(fork['options'])<=3,'Essence fork requires two or three options')
            require(all(isinstance(x,dict) and set(x)=={'title','outcome'} and all(plain(v) for v in x.values()) for x in fork['options']),'Essence fork options require plain title and outcome')
    require(chapters==set(IDS),'Essence must cover the actual 28-section book')
    return data

def collect_essence(source, checked, require):
    manifest=accepted(source,'public/essence-v10-1-manifest.json',require)
    require(manifest['content']['path']=='public/essence-v10-1.json','Unexpected essence source')
    raw=checked(source,manifest['content']);data=validate_essence(json.loads(public_text(raw,require)),require)
    return receipt(manifest,content=manifest['content']),data,{'src/data/essence-v10-1.json':raw}
