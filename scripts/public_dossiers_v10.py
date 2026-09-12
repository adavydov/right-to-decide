"""Explicit allowlist of author-reviewed public model texts and downloads."""
import re
import manuscript_v10
def collect(source, checked, require):
    import json
    path = 'public/research-v10/manifest.json'
    require((source/path).is_file(), 'Final public model dossiers missing: ' + path)
    manifest = json.loads((source/path).read_text(encoding='utf-8-sig'))
    require(manifest.get('decision') == 'accepted' and manifest.get('reviewer'), 'Public dossiers require actual reviewed acceptance')
    require([i['id'] for i in manifest['texts']] == ['INDEX','M01','M02','M03','M04'], 'Five final public dossier texts required')
    data={'editionVersion':'10.0','status':'accepted-public-package','models':[]}
    outputs={}
    for item in manifest['texts']:
        name = 'index' if item['id']=='INDEX' else item['id']
        require(item['path'] == 'public/research-v10/' + name + '.md', 'Unexpected dossier path')
        raw=checked(source,item)
        require(not re.search(r'book-memory|file://|(?<!\w)[A-Za-z]:[\\/]',raw.decode('utf-8-sig'),re.I), 'Private path in public dossier')
        title,blocks,notes,_=manuscript_v10.parse(raw,'research-'+item['id'])
        section={'id':item['id'],'title':title,'blocks':blocks,'notes':notes,'downloads':[]}
        if item['id']=='INDEX':data.update({k:v for k,v in section.items() if k not in ['id','downloads']})
        else:data['models'].append(section)
        outputs['public/research/v10/'+name+'.md']=raw
    seen=set()
    for item in manifest.get('downloads',[]):
        require(item['modelId'] in ['M01','M02','M03','M04'] and item.get('label'), 'Model and download label required')
        require(item['path'].startswith('models/'), 'Only explicitly named files from models/ may be published')
        require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:py|csv|json|md)',item['name']) and item['name'] not in seen, 'Unsafe or duplicate public download name')
        seen.add(item['name'])
        raw=checked(source,item)
        text=raw.decode('utf-8-sig')
        require(not re.search(r'book-memory|file://|(?<!\w)[A-Za-z]:[\\/]|-----BEGIN [A-Z ]*PRIVATE KEY',text,re.I), 'Private path or key in public model file')
        url='/research/v10/files/'+item['name'];outputs['public'+url]=raw
        next(m for m in data['models'] if m['id']==item['modelId'])['downloads'].append({'name':item['name'],'label':item['label'],'path':url})
    return manifest,data,outputs
