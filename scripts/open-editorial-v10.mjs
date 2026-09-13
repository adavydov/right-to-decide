import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
export function verifyV10Transition(root, book) {
  assert.ok(['10.0', '10.1'].includes(book.editionVersion), 'Unsupported v10 edition');
  const local = p => {
    assert.equal(typeof p, 'string');
    assert.ok(p && !path.isAbsolute(p) && !p.includes('\\') && !p.split('/').some(part => ['.', '..', ''].includes(part)), 'Unsafe manifest path');
    const full = path.resolve(root, p), relative = path.relative(root, full);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Path leaves release root');
    return full;
  };
  const read = p => JSON.parse(fs.readFileSync(local(p),'utf8'));
  const hash = p => createHash('sha256').update(fs.readFileSync(local(p))).digest('hex');
  const manifestPath = book.editionVersion === '10.1' ? 'manuscript/v10-1/release-manifest.json' : 'manuscript/v10/release-manifest.json';
  const manifest = read(manifestPath);
  assert.equal(book.source.path, manifestPath);
  if (manifest.editionVersion !== undefined) assert.equal(manifest.editionVersion, book.editionVersion);
  assert.equal(manifest.bookSha256, hash('src/data/book.json'));
  assert.deepEqual(read('src/data/book.json'), book, 'Selected projection differs from pinned book');
  assert.equal(manifest.releaseId, book.releaseId);
  assert.equal(manifest.annotationTransfer, 'none');
  assert.equal(manifest.acceptanceStatus, 'independent-editorial-review');
  for (const item of manifest.artifacts) assert.equal(hash(item.path), item.sha256);
  const mapping = {schema_version:'1.0',chapters:{}};
  const seen = new Set();
  for (const chapter of book.chapters) {
    assert.equal(mapping.chapters[chapter.id], undefined, 'Duplicate chapter identity');
    assert.equal(hash(chapter.source.path),chapter.source.sha256);
    const blocks = [...chapter.blocks,...book.notes.filter(n=>n.chapterId===chapter.id).flatMap(n=>n.blocks)];
    for (const b of blocks) {
      assert.ok(b.id.startsWith('manuscript-v10-'+chapter.id+'-'+chapter.source.sha256.slice(0,12)+'-'));
      assert.ok(!seen.has(b.id), 'Duplicate block identity'); seen.add(b.id);
    }
    mapping.chapters[chapter.id] = {source_sha256:chapter.source.sha256,blocks:Object.fromEntries(blocks.map(b=>[b.id,b.id]))};
  }
  for (const note of book.notes) assert.ok(mapping.chapters[note.chapterId], 'Note refers to absent chapter');
  return mapping;
}
