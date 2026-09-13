import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { validate, sectionIds, webId } from './validate-content-v10-1.mjs';

function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'book-10-1-content-'));
  const hash=raw=>createHash('sha256').update(raw).digest('hex');
  const put=(name,data)=>{const raw=Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data));const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw);return {path:name,sha256:hash(raw),bytes:raw.length};};
  const chapters=sectionIds.map(id=>{
    const source=put('manuscript/v10-1/sources/'+id+'.md',Buffer.from('# Technical '+id+'\n\nFixture only.'));
    const download=put('public/book/chapters/'+webId(id)+'-v10.1.docx',Buffer.from('TECHNICAL FIXTURE'));
    return {id:webId(id),source,version:'10.1',status:'available',blocks:[{id:'manuscript-v10-'+webId(id)+'-'+source.sha256.slice(0,12)+'-p',type:'paragraph',text:'Fixture'}],download:{docx:download.path.slice('public'.length),sha256:download.sha256,bytes:download.bytes}};
  });
  const downloads={};for(const ext of ['md','pdf','docx']){const item=put('public/book/right-to-decide-v10.1.'+ext,Buffer.from('TECHNICAL FIXTURE'));downloads[ext]={...item,path:item.path.slice('public'.length)};}
  const book={editionVersion:'10.1',title:'Fixture',subtitle:'Fixture subtitle',releaseId:'fixture-only',statistics:{sections:28,chapters:26},chapters,notes:[],downloads};
  put('manuscript/v10-1/evidence/BOOK_METADATA.json',{title:book.title,subtitle:book.subtitle});
  put('src/data/research-v10.json',{models:['M01','M02','M03','M04','M05'].map(id=>({id}))});
  put('src/data/library-source-cards.json',{summary:{records:1,cards:1},sources:[{cardCount:1,cards:[{id:'fixture'}]}]});
  put('src/data/editorial-team-v10.json',{version:'10.1',roles:Array.from({length:13},(_,i)=>({id:'fixture-'+i}))});
  put('src/data/essence-v10-1.json',{editionVersion:'10.1',subtitle:book.subtitle,steps:sectionIds.map((chapterId,i)=>({chapterId,id:String(i+1).padStart(2,'0'),part:'one',title:'Step',insight:'Thought',paragraphs:['Technical fixture.']}))});
  const cover=put('public/images/book-cover-v10-1.png',Buffer.from('TECHNICAL FIXTURE'));
  const manifest={editionVersion:'10.1',releaseId:book.releaseId,bookSha256:put('src/data/book.json',book).sha256,annotationTransfer:'none',acceptanceStatus:'independent-editorial-review',artifacts:[],generators:[],checks:{coverSha256:cover.sha256,pdfSectionStartPages:sectionIds.map((_,i)=>i+3),docxVisibleTextExact:true,pdfVisibleTextInOrder:true,pdfCoverFirstPageUnnumbered:true,pdfTitleOnSecondPage:true,docxSectionStartsNewPage:true}};
  const save=()=>{manifest.bookSha256=put('src/data/book.json',book).sha256;put('manuscript/v10-1/release-manifest.json',manifest);};save();
  const cleanup=()=>{
    const resolved=fs.realpathSync(root), temporaryRoot=fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved),temporaryRoot);
    assert.ok(path.basename(resolved).startsWith('book-10-1-content-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  };
  return {root,book,manifest,put,save,cleanup};
}

test('28 sections including lowercase inserts pass without any v9 archive',()=>{const f=fixture();try{validate(f.root,true);assert.equal(f.book.chapters[12].id,'chapter-11a');assert.ok(!fs.existsSync(path.join(f.root,'src/data/edition-v9.json')));}finally{f.cleanup();}});
test('an uppercase insert URL fails even if the book hash is updated',()=>{const f=fixture();try{f.book.chapters[12].id='chapter-11A';f.save();assert.throws(()=>validate(f.root,true));}finally{f.cleanup();}});
test('source-byte substitution fails',()=>{const f=fixture();try{f.put(f.book.chapters[12].source.path,Buffer.from('CHANGED'));assert.throws(()=>validate(f.root,true));}finally{f.cleanup();}});
test('missing M05 public dossier fails',()=>{const f=fixture();try{f.put('src/data/research-v10.json',{models:['M01','M02','M03','M04'].map(id=>({id}))});assert.throws(()=>validate(f.root,true));}finally{f.cleanup();}});
test('private source path fails',()=>{const f=fixture();try{f.book.chapters[0].source.path='../private.md';f.save();assert.throws(()=>validate(f.root,true));}finally{f.cleanup();}});
