"""Verify published reader blocks and file bytes after GitHub Pages deployment."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,urllib.request,time
from html.parser import HTMLParser

class ReaderBlocks(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True)
  self.depth=0; self.active=None; self.blocks={}
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  void=tag in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
  if not void:self.depth+=1
  if 'data-reader-block' in attrs and self.active is None:
   ident=attrs.get('id'); assert ident and ident not in self.blocks
   self.active=(ident,self.depth); self.blocks[ident]=[]
  if self.active:
   meaningful={k:v for k,v in attrs.items() if k in {'id','href','rowspan','colspan','scope','aria-label'}}
   self.blocks[self.active[0]].append(['start',tag,meaningful])
 def handle_endtag(self,tag):
  if tag in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:return
  if self.active:
   self.blocks[self.active[0]].append(['end',tag])
   if self.depth==self.active[1]:self.active=None
  self.depth-=1
 def handle_data(self,data):
  if self.active:self.blocks[self.active[0]].append(['text',data])

def reader_bytes(raw):
 parser=ReaderBlocks();parser.feed(raw.decode('utf-8'));assert parser.blocks,'No reader blocks'
 return json.dumps(parser.blocks,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8'),len(parser.blocks)

ROOT=Path(__file__).resolve().parents[1]
BASE='https://adavydov.github.io/right-to-decide'
def sha(raw): return hashlib.sha256(raw).hexdigest()
def read(p): return json.loads((ROOT/p).read_text(encoding='utf-8-sig'))
book=read('src/data/book.json')
assert book['editionVersion']=='8.0'
checks={}
for c in book['chapters']:
 if c.get('contentKind')=='manuscript' and c.get('status')=='available':
  checks['/read/'+c['id']+'/']=ROOT/'out/read'/c['id']/'index.html'
  checks[c['download']['docx']]=ROOT/'public'/c['download']['docx'].lstrip('/')
assert sum(p.startswith('/read/') for p in checks)==20
for d in book['downloads'].values(): checks[d['path']]=ROOT/'public'/d['path'].lstrip('/')
checks['/editorial/corpus.json']=ROOT/'public/editorial/corpus.json'
corpus=read('public/editorial/corpus.json')
assert corpus['current_edition_id']==book['releaseId']
for edition in corpus['editions']:
 rel='/editorial/editions/'+edition['id']+'/edition.json'
 checks[rel]=ROOT/'public'/rel.lstrip('/')
# Ordinary reader URLs must match the selected reader blocks, independent of Next build IDs.
def verify(item):
 url,path=item
 local_raw=path.read_bytes()
 if url.startswith('/read/'):
  canonical,count=reader_bytes(local_raw); expected=sha(canonical); kind='reader-blocks'
 else:
  expected=sha(local_raw); count=None;kind='file-bytes'
 request=urllib.request.Request(BASE+url,headers={'User-Agent':'RightToDecide-release-verifier/8.0','Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=40) as r:
  raw=r.read(); code=r.status; final=r.url
 actual=sha(reader_bytes(raw)[0]) if kind=='reader-blocks' else sha(raw)
 return {'url':BASE+url,'finalUrl':final,'status':code,'sha256':actual,'expectedSha256':expected,'match':actual==expected,'comparison':kind,'readerBlocks':count}
with ThreadPoolExecutor(max_workers=6) as pool: results=list(pool.map(verify,checks.items()))
failed=[r for r in results if not r['match']]
receipt={'edition':'8.0','releaseId':book['releaseId'],'checkedAtUnix':int(time.time()),'urls':results,'allMatch':not failed,'scope':'Twenty ordinary reader URLs, their Word files, whole Word/PDF, current corpus and every edition manifest. Local complete export validation covers the remaining snapshot files.'}
out=ROOT/'manuscript/2026-09-06-depth-revision/verification'
out.mkdir(exist_ok=True)
(out/'live-v8.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'releaseId':book['releaseId'],'checked':len(results),'allMatch':not failed,'failures':failed},ensure_ascii=False))
if failed: raise SystemExit(1)
