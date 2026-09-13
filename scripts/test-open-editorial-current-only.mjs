import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { currentEditorialCorpus, currentEditorialEdition, currentNoteReference, browserNotesJson } from '../shared/open-editorial-current.mjs';
import { verifyV10Transition } from './open-editorial-v10.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture() {
  const text = 'Текущий самостоятельный вывод.', snapshot = hash('oe-text-v1\0' + text);
  const block = { id: 'same-block', text, normalization: 'oe-text-v1', snapshot_sha256: snapshot, selection_supported: true, reader_url: 'https://example.test/read/chapter-01/#same-block' };
  const chapter = { id: 'chapter-01', title: 'Глава', blocks: [block] };
  const edition = { id: 'literary-manuscript-v10.1-test', chapters: [chapter] };
  const old = { ...structuredClone(edition), id: 'literary-manuscript-v9.0-old' };
  old.chapters[0].blocks[0].text = 'Прежнее другое утверждение.';
  const corpus = { book_id: 'right-to-decide', current_edition_id: edition.id, editions: [old, edition] };
  const target = { scope: 'block', book_id: corpus.book_id, edition_id: edition.id, chapter_id: chapter.id, block_id: block.id, block_snapshot_sha256: snapshot, normalization: 'oe-text-v1' };
  return { corpus, target, old, edition, block };
}

test('selectors expose only the explicit current edition even from a cached multi-edition corpus', () => {
  const f = fixture(), before = JSON.stringify(f);
  assert.equal(currentEditorialEdition(f.corpus), f.edition);
  assert.deepEqual(currentEditorialCorpus(f.corpus).editions, [f.edition]);
  assert.throws(() => currentEditorialCorpus({ ...f.corpus, current_edition_id: 'missing' }));
  assert.equal(JSON.stringify(f), before);
});

test('old notes keep their quote and identity without linking to a reused chapter or block', () => {
  const f = fixture();
  const oldNote = { id: 'old', target: { ...f.target, edition_id: f.old.id }, quote: 'Сохранённая прежняя мысль.', message: 'Моя заметка' };
  const newNote = { id: 'new', target: f.target, quote: f.block.text, message: 'Другая заметка' };
  const notes = [oldNote, newNote], before = JSON.stringify(notes);
  assert.deepEqual(currentNoteReference(oldNote, f.corpus), { available: false, quote: oldNote.quote });
  assert.equal(currentNoteReference(newNote, f.corpus).url, f.block.reader_url);
  assert.deepEqual(JSON.parse(browserNotesJson(notes)).notes, notes);
  assert.equal(JSON.stringify(notes), before);
});

test('missing source, snapshot mismatch and invalid selection cannot become current links', () => {
  const f = fixture();
  for (const update of [{ edition_id: 'missing' }, { book_id: 'other' }, { chapter_id: 'missing' }, { block_id: 'missing' }, { block_snapshot_sha256: '0'.repeat(64) }, { selector: { type: 'TextQuoteSelector', exact: 'Отсутствующая цитата' } }]) {
    const note = { id: 'n', target: { ...f.target, ...update }, message: 'Сохранить', quote: 'Прежний текст' };
    assert.equal(currentNoteReference(note, f.corpus).available, false);
    assert.equal(currentNoteReference(note, f.corpus).url, undefined);
    assert.deepEqual(JSON.parse(browserNotesJson([note])).notes, [note]);
  }
  const noQuote = { id: 'q', target: { ...f.target, edition_id: f.old.id, selector: { type: 'TextQuoteSelector', exact: 'Выделение старой редакции' } }, message: '' };
  assert.equal(currentNoteReference(noQuote, f.corpus).quote, noQuote.target.selector.exact);
});

test('10.1 validates its own book/source/artifacts without any retired public edition', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oe-v10-1-current-'));
  t.after(() => { const rel = path.relative(os.tmpdir(), root); assert.ok(rel && !rel.startsWith('..') && !path.isAbsolute(rel)); fs.rmSync(root, { recursive: true }); });
  const write = (p, value) => { const full = path.join(root, p); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, typeof value === 'string' ? value : JSON.stringify(value)); };
  const source = '# Проверка\n\nТекст.\n', sha = hash(source), id = 'chapter-11a';
  const sourcePath = 'manuscript/v10-1/sources/C11A.md';
  const manifestPath = 'manuscript/v10-1/release-manifest.json';
  const bodyId = `manuscript-v10-${id}-${sha.slice(0,12)}-p001`, noteId = `manuscript-v10-${id}-${sha.slice(0,12)}-note-1-p001`;
  const book = { editionVersion: '10.1', releaseId: 'literary-manuscript-v10.1-test', source: { path: manifestPath }, chapters: [{ id, source: { path: sourcePath, sha256: sha }, blocks: [{ id: bodyId }] }], notes: [{ chapterId: id, blocks: [{ id: noteId }] }] };
  write(sourcePath, source); write('src/data/book.json', book);
  const manifest = { editionVersion: '10.1', releaseId: book.releaseId, bookSha256: hash(JSON.stringify(book)), acceptanceStatus: 'independent-editorial-review', annotationTransfer: 'none', artifacts: [{ path: sourcePath, sha256: sha }] };
  write(manifestPath, manifest);
  const result = verifyV10Transition(root, book);
  assert.deepEqual(Object.keys(result.chapters[id].blocks), [bodyId, noteId]);
  assert.equal(fs.existsSync(path.join(root, 'public/editorial/editions')), false);
  write(sourcePath, source + 'Подмена');
  assert.throws(() => verifyV10Transition(root, book));
  write(sourcePath, source);
  write(manifestPath, { ...manifest, annotationTransfer: 'automatic' });
  assert.throws(() => verifyV10Transition(root, book));
  write(manifestPath, { ...manifest, artifacts: [{ path: '../outside', sha256: sha }] });
  assert.throws(() => verifyV10Transition(root, book), /Unsafe manifest path/);
});

test('the real 10.1 corpus generator prunes retired exports and is reproducible without archives', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oe-current-build-'));
  t.after(() => { const rel = path.relative(os.tmpdir(), root); assert.ok(rel && !rel.startsWith('..') && !path.isAbsolute(rel)); fs.rmSync(root, { recursive: true }); });
  const write = (p, value) => { const full = path.join(root, p); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)); };
  for (const p of ['scripts/build-open-editorial.mjs', 'scripts/open-editorial-v10.mjs', 'scripts/open-editorial-identity-transition.mjs', 'shared/open-editorial-text.mjs', 'shared/open-editorial-layers.mjs', 'src/lib/site-config.ts', 'src/data/site-copy.json', 'CONSTITUTION.md', 'docs/open-editorial/OPEN_EDITORIAL_MANIFESTO.md', 'docs/open-editorial/STATIC_AGENT_GUIDE.md']) write(p, fs.readFileSync(path.join(projectRoot, p)));
  const source = '# Текущий текст\n\nСамостоятельная мысль.\n', sourceSha = hash(source), chapterId = 'chapter-11a';
  const sourcePath = 'manuscript/v10-1/sources/C11A.md', manifestPath = 'manuscript/v10-1/release-manifest.json';
  const blockId = `manuscript-v10-${chapterId}-${sourceSha.slice(0,12)}-p001`;
  const book = { title: 'Проверочный корпус', edition: '2026-09-13', editionVersion: '10.1', releaseId: 'literary-manuscript-v10.1-fixture', publicationStatus: 'published', source: { path: manifestPath, format: 'markdown-manuscript', sha256: hash('fixture identity') }, chapters: [{ id: chapterId, title: 'Текущий текст', version: '10.1', status: 'available', publicationStatus: 'published', source: { path: sourcePath, sha256: sourceSha }, blocks: [{ id: blockId, type: 'paragraph', text: 'Самостоятельная мысль.' }] }], notes: [] };
  write(sourcePath, source); write('src/data/book.json', book);
  write(manifestPath, { editionVersion: '10.1', releaseId: book.releaseId, bookSha256: hash(JSON.stringify(book)), acceptanceStatus: 'independent-editorial-review', annotationTransfer: 'none', artifacts: [{ path: sourcePath, sha256: sourceSha }] });
  write('public/editorial/editions/literary-manuscript-v9.0-retired/edition.json', { id: 'literary-manuscript-v9.0-retired', chapters: [{ text: 'RETIRED-TEXT-MUST-NOT-RETURN' }] });
  const run = args => spawnSync(process.execPath, ['scripts/build-open-editorial.mjs', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000, env: { ...process.env, NEXT_PUBLIC_EDITORIAL_MODE: '', NEXT_PUBLIC_EDITORIAL_API_URL: '' } });
  let result = run([]); assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(fs.readdirSync(path.join(root, 'public/editorial/editions')), [book.releaseId]);
  const corpusPath = path.join(root, 'public/editorial/corpus.json'), before = fs.readFileSync(corpusPath);
  const corpus = JSON.parse(before);
  assert.deepEqual(corpus.editions.map(e => e.id), [book.releaseId]);
  assert.equal(corpus.editions[0].chapters[0].blocks[0].text, book.chapters[0].blocks[0].text);
  assert.equal(before.includes('RETIRED-TEXT-MUST-NOT-RETURN'), false);
  result = run(['--check']); assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(fs.readFileSync(corpusPath), before);
  write('public/editorial/editions/literary-manuscript-v8.0-stray/index.html', 'Retired');
  result = run(['--check']); assert.notEqual(result.status, 0); assert.match(result.stderr, /Retired edition remains/);
});
