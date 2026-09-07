import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { siteConfig } from '../src/lib/site-config.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(dir,name)=>fs.readFileSync(path.join(dir,name),'utf8');
const json=(dir,name)=>JSON.parse(read(dir,name).replace(/^\uFEFF/,''));
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function publicFile(dir,url){
 const parsed=new URL(url),base=new URL(siteConfig.publicUrl+'/');
 assert.equal(parsed.origin,base.origin,'Published file stays on the configured public origin.');
 assert.ok(parsed.pathname.startsWith(base.pathname),'Published file keeps the site base path.');
 assert.equal(parsed.username+parsed.password+parsed.search,'','No credentials or private query in published file URL.');
 const relative=decodeURIComponent(parsed.pathname.slice(base.pathname.length));
 const resolved=path.resolve(dir,'public',relative),publicRoot=path.resolve(dir,'public');
 assert.ok(path.relative(publicRoot,resolved)&&!path.relative(publicRoot,resolved).startsWith('..'));
 assert.ok(fs.statSync(resolved).isFile(),relative+' exists as a static file.');
 return resolved;
}
function assertStaticContract(dir){
 const manifest=json(dir,'public/open-editorial/agent-manifest.json');
 assert.equal(manifest.mode,'static');assert.equal(manifest.configuration_status,'static');assert.equal(manifest.api_root,null);assert.equal(manifest.capability_authority,null);
 assert.equal(manifest.auth.public_read,'none');assert.equal(manifest.auth.submission,null);assert.equal(manifest.auth.registration_url,null);
 assert.equal(manifest.capabilities.read_published_text,true);assert.equal(manifest.capabilities.prepare_local_draft,true);
 for(const name of ['submit_contribution','read_own_receipt','write_book','editorial_decisions','read_private_notes'])assert.equal(manifest.capabilities[name],false,name);
 for(const name of ['corpus_url','openapi_url','guide_url'])publicFile(dir,manifest[name]);
 const spec=json(dir,'public/open-editorial/openapi.json');assert.ok(spec.openapi.startsWith('3.1.'));
 assert.deepEqual(spec.servers,[{url:siteConfig.publicUrl}]);assert.ok(!spec.security?.length);assert.equal(Object.keys(spec.components?.securitySchemes||{}).length,0);
 const corpus=json(dir,'public/editorial/corpus.json');
 assert.equal(Object.keys(spec.paths).length,8);
 for(const [template,item]of Object.entries(spec.paths)){
  assert.deepEqual(Object.keys(item),['get'],'Every advertised action is a static GET.');assert.ok(template.startsWith('/editorial/'));
  const examples=template.includes('{chapter_id}')?corpus.editions.flatMap(e=>e.chapters.map(c=>[e.id,c.id])):template.includes('{edition_id}')?corpus.editions.map(e=>[e.id,'']):[['','']];
  for(const [edition,chapter]of examples)publicFile(dir,siteConfig.publicUrl+template.replace('{edition_id}',edition).replace('{chapter_id}',chapter));
 }
}

test('static discovery advertises only existing public file GETs without auth or write promises',()=>assertStaticContract(root));

test('public corpus references complete immutable files and keeps original manifesto bytes',()=>{
 const corpus=json(root,'public/editorial/corpus.json');
 assert.equal(corpus.layers.items.length,9);
 for(const edition of corpus.editions){
  publicFile(root,edition.canonical_url);
  for(const chapter of edition.chapters){
   for(const key of ['canonical_url','json_url','markdown_url','text_url'])publicFile(root,chapter[key]);
   const snapshot=json(root,path.relative(root,publicFile(root,chapter.json_url)));
   assert.deepEqual(snapshot,chapter);
   const html=read(root,path.relative(root,publicFile(root,chapter.canonical_url)));
   for(const block of chapter.blocks){assert.equal(block.snapshot_sha256,digest('oe-text-v1\0'+block.text));assert.ok(html.includes('id="'+block.id+'"'));
    assert.ok(!block.reader_url.includes('?'));assert.ok(!block.canonical_url.includes('?'));
   }
  }
 }
 const original=fs.readFileSync(path.join(root,'docs/open-editorial/OPEN_EDITORIAL_MANIFESTO.md'));
 assert.equal(digest(original),'9e29567a9908bf858a6f3c09a2c5c0c3e2518ab05c17de2307d6c0e311cc7583');
 assert.deepEqual(fs.readFileSync(path.join(root,'public/editorial/manifesto.md')),original);
});

test('default static generator is reproducible in a minimal checkout with no service or npm modules',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oe-static-build-'));
 t.after(()=>{const within=path.relative(os.tmpdir(),dir);assert.ok(within&&!within.startsWith('..')&&!path.isAbsolute(within));assert.ok(path.basename(dir).startsWith('oe-static-build-'));fs.rmSync(dir,{recursive:true,force:true});});
 const inputs=['scripts/open-editorial-identity-transition.mjs','scripts/build-open-editorial.mjs','shared/open-editorial-text.mjs','shared/open-editorial-layers.mjs','src/lib/site-config.ts','src/data/site-copy.json','src/data/book.json','CONSTITUTION.md','docs/open-editorial/OPEN_EDITORIAL_MANIFESTO.md','docs/open-editorial/block-identities.json','docs/open-editorial/STATIC_AGENT_GUIDE.md'];
 const book=json(root,'src/data/book.json');
 const receiptPath='docs/open-editorial/identity-transitions/'+book.releaseId+'.json';
 if(fs.existsSync(path.join(root,receiptPath))){
  const receipt=json(root,receiptPath),selection=json(root,receipt.publication_selection.path);
  const release=json(root,receipt.release_manifest.path);
  inputs.push(...[release.prologue,...release.chapters,release.authorContents].map(item=>item.path));
  inputs.push(receiptPath,...[receipt.book,receipt.release_manifest,receipt.publication_selection,receipt.previous_identity_map,receipt.previous_corpus,receipt.previous_edition,...selection.inputs,...receipt.frozen_files].map(item=>item.path));
 }
 for(const input of new Set(inputs)){const dest=path.join(dir,input);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,input),dest);}
 // fs.cpSync exits natively on this Windows Node 24.14.1 host; copy the identical fixture using explicit traversal.
 const copyTree=(from,to)=>{
  fs.mkdirSync(to,{recursive:true});
  for(const entry of fs.readdirSync(from,{withFileTypes:true})){
   const source=path.join(from,entry.name),destination=path.join(to,entry.name);
   if(entry.isDirectory())copyTree(source,destination);
   else{assert.ok(entry.isFile(),'Published fixture contains only regular files and directories.');fs.copyFileSync(source,destination);}
  }
 };
 copyTree(path.join(root,'public/editorial/editions'),path.join(dir,'public/editorial/editions'));
 assert.equal(fs.existsSync(path.join(dir,'open-editorial-service')),false);assert.equal(fs.existsSync(path.join(dir,'node_modules')),false);
 const env={...process.env,NEXT_PUBLIC_EDITORIAL_MODE:'',NEXT_PUBLIC_EDITORIAL_API_URL:'https://must-not-contact.invalid/v1'};
 for(const args of [[],['--check']]){const result=spawnSync(process.execPath,['scripts/build-open-editorial.mjs',...args],{cwd:dir,env,encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(result.status,0,result.stderr||result.stdout);}
 assertStaticContract(dir);
 assert.equal(read(dir,'public/open-editorial/agents/guide.md'),read(root,'docs/open-editorial/STATIC_AGENT_GUIDE.md'));
 assert.deepEqual(json(dir,'public/editorial/corpus.json'),json(root,'public/editorial/corpus.json'));
 assert.ok(!read(dir,'public/open-editorial/agent-manifest.json').includes('must-not-contact.invalid'));
});

function fixture(){
 const text='Тезис 😀. Повтор. Повтор. 👩‍🔬',hash=digest('oe-text-v1\0'+text);
 const block={id:'b1',text,normalization:'oe-text-v1',snapshot_sha256:hash,selection_supported:true,canonical_url:'https://example.test/e1/c1.html#b1'};
 const chapter={id:'c1',title:'Глава',canonical_url:'https://example.test/e1/c1.html',blocks:[block]};
 const edition={id:'e1',title:'Редакция',published_at:'2026-09-06',chapters:[chapter]};
 const corpus={book_id:'right-to-decide',current_edition_id:'e1',editions:[edition]};
 const target={scope:'block',book_id:corpus.book_id,edition_id:edition.id,chapter_id:chapter.id,block_id:block.id,block_snapshot_sha256:hash,normalization:'oe-text-v1',selector:{type:'TextQuoteSelector',exact:'😀'}};
 return{corpus,target,block,chapter,edition};
}
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};

test('local draft accepts a faithful Unicode target and never mutates the selected published snapshot',async()=>{
 const {validateLocalDraftTarget}=await import('../shared/open-editorial-draft.mjs');const f=fixture();
 const before=JSON.stringify(f);freeze(f);
 assert.equal(validateLocalDraftTarget(f.target,f.corpus).valid,true);assert.equal(JSON.stringify(f),before);
});

test('local draft rejects mismatched identity, snapshot, ambiguous quote and unsupported partial selection',async()=>{
 const {validateLocalDraftTarget}=await import('../shared/open-editorial-draft.mjs');const f=fixture();
 for(const changed of [{book_id:'other'},{edition_id:'other'},{chapter_id:'other'},{block_id:'other'},{block_snapshot_sha256:'0'.repeat(64)},{normalization:'other'},{selector:{type:'TextQuoteSelector',exact:'Повтор.'}},{selector:{type:'TextQuoteSelector',exact:'👩'}},{selector:{type:'TextQuoteSelector',exact:'Не существует'}}])assert.equal(validateLocalDraftTarget({...f.target,...changed},f.corpus).valid,false,JSON.stringify(changed));
 const unsupported=structuredClone(f.corpus);unsupported.editions[0].chapters[0].blocks[0].selection_supported=false;
 assert.equal(validateLocalDraftTarget(f.target,unsupported).valid,false);
 assert.equal(validateLocalDraftTarget({...f.target,selector:undefined},unsupported).valid,true,'Whole unsupported block remains a truthful fallback.');
});

test('local draft exports preserve author text but never manufacture receipt, consent or credentials',async()=>{
 const {localDraftJson,localDraftMarkdown}=await import('../shared/open-editorial-draft.mjs');const f=fixture();
 const marker='UNEXPECTED-PRIVATE-CREDENTIAL-MARKER';
 const draft={draft_schema_version:'1.0',state:'published',created_at:'2026-09-06T00:00:00Z',target:f.target,edition_title:f.edition.title,chapter_title:f.chapter.title,canonical_url:f.block.canonical_url,quote:'😀',kind:'objection',message:'Моё возражение — без автоматической передачи.',origin:{mode:'ai_assisted',assistance_note:'Помощь с проверкой.'},credential:marker,token:marker,owner_id:marker,receipt_id:marker,consent:marker,policy_bundle_id:marker};
 const serialized=localDraftJson(draft),value=typeof serialized==='string'?JSON.parse(serialized):serialized;
 assert.equal(value.state,'local_draft');assert.equal(value.draft_schema_version,'1.0');assert.deepEqual(value.target,f.target);assert.equal(value.message,draft.message);assert.ok(!JSON.stringify(value).includes(marker));
 const markdown=localDraftMarkdown(draft);assert.ok(markdown.includes('Личный черновик'));assert.ok(markdown.includes('Не отправлен'));assert.ok(markdown.includes(f.target.block_snapshot_sha256));assert.ok(markdown.includes('😀'));assert.ok(markdown.includes(draft.message));assert.ok(!markdown.includes(marker));
});
