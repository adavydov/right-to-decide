import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const sectionIds = ['P00', ...Array.from({length:11}, (_,i) => 'C'+String(i+1).padStart(2,'0')), 'C11A', 'C11B', ...Array.from({length:13}, (_,i) => 'C'+String(i+12).padStart(2,'0')), 'E00'];
export const webId = id => id === 'P00' ? 'prologue' : id === 'E00' ? 'epilogue' : 'chapter-'+id.slice(1).toLowerCase();
const privatePath = /book-memory|file:\/\/|(?<!\w)[A-Z]:[\\/]|-----BEGIN [A-Z ]*PRIVATE KEY/i;

export function validate(root = process.cwd(), quiet = false) {
  const local = relative => {
    assert.equal(typeof relative,'string');
    assert.ok(!relative.includes('\\') && !path.isAbsolute(relative) && relative.split('/').every(x => x && x!=='.' && x!=='..'), 'Unsafe relative path');
    const target=path.resolve(root,relative);
    assert.ok(!path.relative(path.resolve(root),target).startsWith('..'), 'Path escapes root');
    return target;
  };
  const raw = p => fs.readFileSync(local(p));
  const read = p => JSON.parse(raw(p).toString('utf8').replace(/^\uFEFF/,''));
  const hash = p => createHash('sha256').update(raw(p)).digest('hex');
  const check = item => {
    assert.equal(hash(item.path),item.sha256,'Changed artifact: '+item.path);
    if (item.bytes!==undefined) assert.equal(raw(item.path).length,item.bytes);
  };
  const book=read('src/data/book.json'), manifest=read('manuscript/v10-1/release-manifest.json');
  assert.equal(book.editionVersion,'10.1'); assert.equal(manifest.editionVersion,'10.1');
  assert.equal(hash('src/data/book.json'),manifest.bookSha256);
  assert.equal(book.releaseId,manifest.releaseId);
  assert.equal(manifest.annotationTransfer,'none');
  assert.equal(manifest.acceptanceStatus,'independent-editorial-review');
  assert.deepEqual(book.chapters.map(c=>c.id),sectionIds.map(webId));
  assert.equal(book.statistics.sections,28); assert.equal(book.statistics.chapters,26);
  const metadata=read('manuscript/v10-1/evidence/BOOK_METADATA.json');
  assert.equal(book.title,metadata.title);assert.equal(book.subtitle,metadata.subtitle);
  const notes=new Map(book.notes.map(n=>[n.id,n]));assert.equal(notes.size,book.notes.length);
  const blockIds=new Set();
  for (const [index,chapter] of book.chapters.entries()) {
    assert.equal(chapter.source.path,'manuscript/v10-1/sources/'+sectionIds[index]+'.md');
    check(chapter.source);assert.equal(chapter.version,'10.1');assert.equal(chapter.status,'available');
    const prefix='manuscript-v10-'+chapter.id+'-'+chapter.source.sha256.slice(0,12);
    for (const block of [...chapter.blocks,...book.notes.filter(n=>n.chapterId===chapter.id).flatMap(n=>n.blocks)]) {
      assert.ok(!blockIds.has(block.id));blockIds.add(block.id);assert.ok(block.id.startsWith(prefix));
      for (const run of block.type==='table' ? block.cellRuns.flat(2) : block.runs || []) {
        if (run.noteId) assert.equal(notes.get(run.noteId)?.chapterId,chapter.id,'Note belongs to another chapter');
        if (run.href) {const u=new URL(run.href);assert.ok(['https:','http:'].includes(u.protocol) && !u.username && !u.password);}
      }
    }
  }
  const artifacts=new Set();
  for (const item of manifest.artifacts) {assert.ok(!artifacts.has(item.path));artifacts.add(item.path);check(item);}
  for (const item of manifest.generators) check(item);
  for (const item of Object.values(book.downloads)) check({path:'public'+item.path,sha256:item.sha256,bytes:item.bytes});
  for (const chapter of book.chapters) check({path:'public'+chapter.download.docx,sha256:chapter.download.sha256,bytes:chapter.download.bytes});
  assert.equal(manifest.checks.coverSha256,hash('public/images/book-cover-v10-1.png'));
  assert.equal(manifest.checks.pdfSectionStartPages.length,28);
  for (const key of ['docxVisibleTextExact','pdfVisibleTextInOrder','pdfCoverFirstPageUnnumbered','pdfTitleOnSecondPage','docxSectionStartsNewPage']) assert.equal(manifest.checks[key],true);
  assert.deepEqual(read('src/data/research-v10.json').models.map(m=>m.id),['M01','M02','M03','M04','M05']);
  const cards=read('src/data/library-source-cards.json');
  assert.equal(cards.summary.records,cards.sources.length);
  assert.equal(cards.summary.cards,cards.sources.reduce((n,s)=>n+s.cards.length,0));
  for (const source of cards.sources) assert.equal(source.cardCount,source.cards.length);
  const team=read('src/data/editorial-team-v10.json');assert.equal(team.version,'10.1');assert.equal(new Set(team.roles.map(r=>r.id)).size,13);
  const essence=read('src/data/essence-v10-1.json');assert.equal(essence.editionVersion,'10.1');assert.equal(essence.subtitle,metadata.subtitle);
  assert.deepEqual(essence.steps.map(s=>s.chapterId),sectionIds);
  assert.deepEqual(essence.steps.map(s=>s.id),Array.from({length:28},(_,i)=>String(i+1).padStart(2,'0')));
  const plain=value=>typeof value==='string' && value.trim().length>0 && !value.includes('<');
  for (const step of essence.steps) {
    for (const field of ['id','chapterId','part','title','insight']) assert.ok(plain(step[field]));
    assert.ok(Array.isArray(step.paragraphs) && step.paragraphs.length && step.paragraphs.every(plain));
    if (step.fork) {
      assert.deepEqual(Object.keys(step.fork).sort(),['options','question']);assert.ok(plain(step.fork.question));
      assert.ok(Array.isArray(step.fork.options) && [2,3].includes(step.fork.options.length));
      for (const option of step.fork.options) {assert.deepEqual(Object.keys(option).sort(),['outcome','title']);assert.ok(plain(option.title) && plain(option.outcome));}
    }
  }
  for (const data of [book,cards,team,essence]) assert.ok(!privatePath.test(JSON.stringify(data)),'Private data in public projection');
  if (!quiet) console.log('V10.1 CONTENT PASS: 28 sections, lowercase insert IDs, exact files, current public packages; no public archive dependency');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) validate();
