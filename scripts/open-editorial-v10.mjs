import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
export function verifyV10Transition(root, book) {
  const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
  const hash = p => createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
  const manifest = read('manuscript/v10/release-manifest.json');
  assert.equal(manifest.bookSha256, hash('src/data/book.json'));
  assert.equal(manifest.releaseId, book.releaseId);
  assert.equal(manifest.annotationTransfer, 'none');
  assert.equal(manifest.acceptanceStatus, 'independent-editorial-review');
  for (const item of read('docs/publishing/v10/archive-v9.json').files) assert.equal(hash(item.path), item.sha256, 'Immutable edition changed: '+item.path);
  for (const item of manifest.artifacts) assert.equal(hash(item.path), item.sha256);
  const mapping = {schema_version:'1.0',chapters:{}};
  for (const chapter of book.chapters) {
    assert.equal(hash(chapter.source.path),chapter.source.sha256);
    const blocks = [...chapter.blocks,...book.notes.filter(n=>n.chapterId===chapter.id).flatMap(n=>n.blocks)];
    for (const b of blocks) assert.ok(b.id.startsWith('manuscript-v10-'+chapter.id+'-'+chapter.source.sha256.slice(0,12)+'-'));
    mapping.chapters[chapter.id] = {source_sha256:chapter.source.sha256,blocks:Object.fromEntries(blocks.map(b=>[b.id,b.id]))};
  }
  return mapping;
}
