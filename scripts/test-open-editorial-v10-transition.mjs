import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyV10Transition } from './open-editorial-v10.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative));
const json = relative => JSON.parse(read(relative).toString('utf8').replace(/^\uFEFF/, ''));
const book = json('src/data/book.json');
const manifestPath = book.editionVersion === '10.1' ? 'manuscript/v10-1/release-manifest.json' : 'manuscript/v10/release-manifest.json';
const manifest = json(manifestPath);
const oldEditionPath = 'docs/open-editorial/test-fixtures/v9/public/editorial/editions/literary-manuscript-v9.0-26472e4aa686/edition.json';

function changeRead(t, relative, transform) {
  const original = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    const result = original(file, ...args);
    return path.resolve(String(file)) === path.resolve(root, relative) ? transform(result) : result;
  });
}

test('v10 uses its real manifest and exact installed identities, including notes', () => {
  assert.ok(['10.0', '10.1'].includes(book.editionVersion));
  const mapping = verifyV10Transition(root, book);
  assert.deepEqual(mapping, json('docs/open-editorial/block-identities.json'));
  assert.equal(Object.keys(mapping.chapters).length, book.chapters.length);
  const corpus = json('public/editorial/corpus.json');
  assert.equal(corpus.current_edition_id, book.releaseId);
  const published = corpus.editions.find(e => e.id === book.releaseId);
  assert.ok(published);
  assert.deepEqual(published, json('public/editorial/editions/' + book.releaseId + '/edition.json'));
  const old = json(oldEditionPath);
  assert.deepEqual(corpus.editions.map(e => e.id), [book.releaseId]);
  assert.equal(corpus.edition_policy, 'current-only');
  assert.equal(corpus.annotation_transfer, 'none');
  const oldIds = new Set(old.chapters.flatMap(c => c.blocks.map(b => b.id)));
  const seen = new Set();
  let noteBlocks = 0;
  for (const chapter of book.chapters) {
    const notes = book.notes.filter(n => n.chapterId === chapter.id).flatMap(n => n.blocks);
    noteBlocks += notes.length;
    const ids = [...chapter.blocks, ...notes].map(b => b.id);
    assert.deepEqual(Object.keys(mapping.chapters[chapter.id].blocks), ids);
    assert.deepEqual(published.chapters.find(c => c.id === chapter.id).blocks.map(b => b.id), ids);
    for (const id of ids) {
      assert.equal(mapping.chapters[chapter.id].blocks[id], id);
      assert.equal(oldIds.has(id), false, 'No automatic transfer from a v9 block or note');
      assert.equal(seen.has(id), false, 'A block has one identity');
      seen.add(id);
    }
  }
  assert.ok(noteBlocks > 0, 'The check must cover real note blocks');
  assert.equal(manifest.annotationTransfer, 'none');
});

for (const [field, value] of [['annotationTransfer', 'automatic'], ['acceptanceStatus', 'unchecked'], ['releaseId', 'literary-manuscript-v10.0-wrong'], ['bookSha256', '0'.repeat(64)]]) {
  test('v10 rejects a changed manifest ' + field, t => {
    changeRead(t, manifestPath, () => JSON.stringify({...manifest, [field]: value}));
    assert.throws(() => verifyV10Transition(root, book));
  });
}

for (const [label, relative] of [
  ['selected book bytes', 'src/data/book.json'],
  ['accepted source bytes', book.chapters[0].source.path],
  ['download artifact', manifest.artifacts.find(a => a.path.endsWith('.docx')).path],
]) {
  test('v10 rejects modified ' + label, t => {
    changeRead(t, relative, bytes => Buffer.concat([Buffer.from(bytes), Buffer.from('changed')]));
    assert.throws(() => verifyV10Transition(root, book));
  });
}

for (const kind of ['body', 'note']) {
  test('v10 rejects a v9 identity substituted into a ' + kind + ' block', () => {
    const changed = structuredClone(book);
    const old = json(oldEditionPath);
    const block = kind === 'body' ? changed.chapters[0].blocks[0] : changed.notes[0].blocks[0];
    block.id = old.chapters[0].blocks[0].id;
    assert.throws(() => verifyV10Transition(root, changed));
  });
}

test('v10 fails without its own manifest and needs no legacy transition receipt', t => {
  const legacyReceipt = path.join(root, 'docs/open-editorial/identity-transitions/' + book.releaseId + '.json');
  const original = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    assert.notEqual(path.resolve(String(file)), legacyReceipt, 'v10 must use its own manifest');
    return original(file, ...args);
  });
  verifyV10Transition(root, book);
  changeRead(t, manifestPath, () => { throw Object.assign(new Error('Missing v10 manifest'), {code: 'ENOENT'}); });
  assert.throws(() => verifyV10Transition(root, book), /Missing v10 manifest/);
});
