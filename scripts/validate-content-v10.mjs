import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const book = read('src/data/book.json'), manifest = read('manuscript/v10/release-manifest.json');
assert.equal(book.editionVersion, '10.0');
assert.equal(hash('src/data/book.json'), manifest.bookSha256);
assert.deepEqual(book.chapters.map(c => c.id), ['prologue', ...Array.from({length:24}, (_,i) => 'chapter-' + String(i+1).padStart(2,'0')), 'epilogue']);
const notes = new Set(book.notes.map(n => n.id)), ids = new Set();
for (const chapter of book.chapters) {
  assert.equal(hash(chapter.source.path), chapter.source.sha256);
  assert.equal(chapter.status, 'available');
  for (const block of [...chapter.blocks, ...book.notes.filter(n => n.chapterId === chapter.id).flatMap(n => n.blocks)]) {
    assert.ok(!ids.has(block.id)); ids.add(block.id);
    assert.ok(block.id.startsWith('manuscript-v10-' + chapter.id + '-' + chapter.source.sha256.slice(0,12)));
    for (const run of block.type === 'table' ? block.cellRuns.flat(2) : block.runs || []) {
      if (run.noteId) assert.ok(notes.has(run.noteId));
      if (run.href) { const u = new URL(run.href); assert.ok(['https:', 'http:'].includes(u.protocol) && !u.username && !u.password); }
    }
  }
}
for (const file of manifest.artifacts) assert.equal(hash(file.path), file.sha256);
for (const file of read('docs/publishing/v10/archive-v9.json').files) assert.equal(hash(file.path), file.sha256, 'Archive changed: '+file.path);
for (const file of read('docs/publishing/v10/archive-library-v9.json').files) assert.equal(hash(file.path), file.sha256, 'Archive bibliography changed: '+file.path);
for (const file of read('docs/publishing/v10/archive-editorial-v9.json').files) assert.equal(hash(file.path), file.sha256, 'Archive editorial changed: '+file.path);
// A drive prefix starts a token; the final "s:/" in an HTTPS URL does not.
const privatePath = /book-memory|file:\/\/|\b[A-Z]:[\\/]/i;
assert.ok(!privatePath.test(JSON.stringify(book)));
console.log('V10 CONTENT PASS: 26 sections, exact source projection, immutable v9 and separate identities');
