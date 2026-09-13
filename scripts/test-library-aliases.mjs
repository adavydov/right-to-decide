import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isLibraryAlias, visibleLibrarySources, libraryAliasTargets } from '../shared/library-aliases.mjs';
const data = JSON.parse(fs.readFileSync(new URL('../src/data/library-source-cards.json', import.meta.url)));

test('historical catalog IDs resolve to real cards without duplicating them in the main catalog', () => {
  const before = JSON.stringify(data), visible = visibleLibrarySources(data.sources);
  assert.equal(visible.length, data.sources.length - data.sources.filter(isLibraryAlias).length);
  assert.equal(visible.reduce((n, s) => n + s.cardCount, 0), data.summary.cards);
  const expected = { 'ref-015': 'ref-011', 'ref-022': 'ref-082', 'ref-041': 'ref-042' };
  for (const [id, target] of Object.entries(expected)) {
    const source = data.sources.find(s => s.id === id);
    assert.ok(source && isLibraryAlias(source));
    assert.equal(source.cards.length, 0);
    assert.ok(!visible.some(s => s.id === id));
    const targets = libraryAliasTargets(source, data.sources);
    assert.deepEqual(targets.map(s => s.id), [target]);
    assert.ok(targets[0].cards.length > 0 && targets[0].cards.length === targets[0].cardCount);
  }
  assert.equal(JSON.stringify(data), before);
});

test('a catalog entry without its own reading is not silently hidden as an alias', () => {
  const entry = { id: 'ref-test', reading: { kind: 'catalog' }, cardCount: 0, links: [] };
  assert.deepEqual(visibleLibrarySources([entry]), [entry]);
  assert.deepEqual(libraryAliasTargets(entry, [entry]), []);
});
