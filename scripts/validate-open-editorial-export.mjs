import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getOpenEditorialManifesto } from '../src/lib/open-editorial-manifesto.ts';
const base=(process.env.NEXT_PUBLIC_BASE_PATH||'').replace(/\/$/,'');
const active=['','manifesto','manifesto/history','participate','me','agents','agents/guide','privacy','rules'];
const retired=['admin','contribution','discussions','tasks','changes','support','participants'];
const root=path.resolve('out');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const visible=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
function localFile(link){
 assert.ok(!base||link.startsWith(base+'/')||link===base,'Site base path is missing: '+link);
 const local=decodeURIComponent(link.slice(base.length).split(/[?#]/)[0]);
 const candidate=path.join(root,local);
 assert.ok(fs.existsSync(candidate)||fs.existsSync(path.join(candidate,'index.html')),'Linked static asset/route missing: '+local);
}
for(const route of [...active,...retired]){
 const html=read('open-editorial/'+(route?route+'/':'')+'index.html');
 const page=visible(html),main=page.match(/<main\b([^>]*)>([\s\S]*?)<\/main>/i);
 assert.ok(main,route+' main');
 assert.ok(/\bid="main-content"/.test(main[1]),route+' main identity');
 assert.ok(/\bdata-editorial-mode="static"/.test(main[1]),route+' must render explicit static mode');
 for(const link of [...page.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]).filter(x=>x.startsWith('/')&&!x.startsWith('//')))localFile(link);
 const content=main[2];
 assert.ok(!/<input\b[^>]*\btype="(?:email|password)"/i.test(content),route+' must not solicit auth or email');
 assert.ok(!/<form\b[^>]*\b(?:action="https?:|method="post")/i.test(content),route+' must not submit to a server');
 assert.ok(!/<(?:input|textarea|select)\b[^>]*\bname="(?:message|note|quote|email|token|credential|password|source|title|proposed_text)"/i.test(content),route+' must not serialize private fields into native form query');
 for(const target of retired)assert.ok(!new RegExp('href="'+base+'/open-editorial/'+target+'(?:/|[?"#])').test(content),route+' links to an unsupported workflow '+target);
 for(const match of content.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/gi)){
  const label=match[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  assert.ok(!/^(?:Войти|Получить письмо для входа|Подтвердить код|Выдать ключ|Отправить на рассмотрение|Публично отметить сильное место|Сохраняем на сервере|Применить решение)/i.test(label),route+' exposes unsupported action: '+label);
 }
 if(retired.includes(route))assert.ok(!/<(?:form|button|input|textarea|select)\b/i.test(content),route+' is a readonly notice, not an inactive control panel');
}
const manifestoText=visible(read('open-editorial/manifesto/index.html')).replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|#x27|#39);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#x27;':"'",'&#39;':"'"}[e])).replace(/\s+/g,' ');
for(const block of getOpenEditorialManifesto().blocks.filter(b=>b.kind!=='rule'))assert.ok(manifestoText.includes(block.text.replace(/\*\*/g,'').replace(/\s+/g,' ').trim()),'Manifesto block missing or rewritten: '+block.id);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(fs.readFileSync('docs/open-editorial/OPEN_EDITORIAL_MANIFESTO.md')),hash(fs.readFileSync(path.join(root,'editorial/manifesto.md'))));
const discovery=JSON.parse(read('open-editorial/agent-manifest.json'));
assert.equal(discovery.mode,'static');assert.equal(discovery.configuration_status,'static');assert.equal(discovery.api_root,null);assert.equal(discovery.capability_authority,null);
assert.equal(discovery.auth.submission,null);assert.equal(discovery.auth.registration_url,null);
for(const name of ['submit_contribution','read_own_receipt','write_book','editorial_decisions','read_private_notes'])assert.equal(discovery.capabilities[name],false,name);
assert.equal(discovery.capabilities.read_published_text,true);assert.equal(discovery.capabilities.prepare_local_draft,true);
const spec=JSON.parse(read('open-editorial/openapi.json'));
assert.ok(spec.openapi.startsWith('3.1.'));assert.ok(!spec.security?.length);assert.equal(Object.keys(spec.components?.securitySchemes||{}).length,0);
for(const [file,operations]of Object.entries(spec.paths)){assert.ok(file.startsWith('/editorial/'));assert.deepEqual(Object.keys(operations),['get'],'Only static file reads are documented.');}
const files=fs.readdirSync(root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.join(e.parentPath,e.name));
assert.equal(files.filter(f=>/\.sqlite(?:-wal|-shm)?$|\.token\.json$|(?:^|[\\/])\.env(?:\.local)?$|[\\/](?:book-memory|source-pack-v1\.0|open-editorial-service|verification)[\\/]|[\\/](?:SECURITY_REVIEW|ACCEPTANCE_REPORT|CONSTITUTION_MATRIX)\.md$/i.test(f)).length,0,'Private/service materials must not enter static export.');
const scripts=files.filter(file=>file.endsWith('.js')).map(file=>read(path.relative(root,file))).join('\n');
for(const marker of ['draft-copy','draft-download','local-notes'])assert.ok(scripts.includes(marker),'Local client action missing from generated bundle: '+marker);
for(const file of files.filter(f=>/\.(?:json|html|js|md|txt)$/.test(f)))assert.ok(!/oe_(?:human|agent|internal)_[A-Za-z0-9_-]{40,}/.test(fs.readFileSync(file,'utf8')),'Credential in static export: '+file);
console.log(JSON.stringify({status:'PASS',mode:'static',base_path:base,active_routes:active.length,readonly_retired_routes:retired.length,manifesto_blocks:getOpenEditorialManifesto().blocks.length,documented_get_paths:Object.keys(spec.paths).length,static_files_scanned:files.length,private_artifacts:0,browser_interactions:'NOT_RUN'}));
