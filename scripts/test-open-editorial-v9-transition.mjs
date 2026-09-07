import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveTransition, verifyTransition, encode } from "./open-editorial-identity-transition.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = "literary-manuscript-v8.0-f3c9128893a3";
const json = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, ""));
function fixture() {
  // Reuse actual published 8.0 bytes and identities; synthetic changes stay in memory.
  const oldEdition = json("public/editorial/editions/" + baseline + "/edition.json");
  const book = json("docs/open-editorial/identity-transitions/archives/" + baseline + "/book.json");
  const previous = {schema_version: "1.0", chapters: Object.fromEntries(oldEdition.chapters.map(c => [c.id,
    {source_sha256: c.source_sha256, blocks: Object.fromEntries(c.blocks.map(b => [b.dom_id, b.id]))}]))};
  book.editionVersion = "9.0";
  book.releaseId = "literary-manuscript-v9.0-contract-fixture";
  const sample = structuredClone(book.chapters.find(c => c.id === "contents").blocks.find(b => b.type === "paragraph"));
  sample.id = "manuscript-v9-appendix-d-p001";
  book.chapters.push({id: "appendix-d", kind: "appendix", version: "1.6", status: "available", publicationStatus: "published",
    source: {sha256: "a".repeat(64)}, blocks: [sample]});
  return {previous, oldEdition, book};
}

test("9.0 retains all exact published identities and adds appendix D without transferring annotations", () => {
  const {previous, oldEdition, book} = fixture();
  const {mapping, transitions} = deriveTransition(previous, oldEdition, book);
  assert.deepEqual(Object.keys(mapping.chapters), [...Object.keys(previous.chapters), "appendix-d"]);
  assert.equal(transitions.filter(t => t.action === "retain-identical-blocks").length, 21);
  const added = transitions.at(-1);
  assert.equal(added.action, "new-chapter-no-annotation-transfer");
  assert.equal(added.from_source_sha256, null);
  assert.deepEqual(added.retired_block_ids, []);
  assert.deepEqual(added.retained_block_ids, []);
  assert.deepEqual(added.introduced_block_ids, ["manuscript-v9-appendix-d-p001"]);
});

test("9.0 rejects a missing or wrong appendix and any removed baseline section", () => {
  for (const mutate of [b => b.chapters.pop(), b => b.chapters.at(-1).id = "appendix-a", b => b.chapters.splice(2, 1), b => b.chapters.at(-1).version = "1.5"]) {
    const {previous, oldEdition, book} = fixture(); mutate(book);
    assert.throws(() => deriveTransition(previous, oldEdition, book));
  }
});

test("added and changed sources cannot reuse earlier block identities", () => {
  const {previous, oldEdition, book} = fixture();
  book.chapters.at(-1).blocks[0].id = book.chapters[0].blocks[0].id;
  assert.throws(() => deriveTransition(previous, oldEdition, book), /entirely new/);
  const second = fixture(); second.book.chapters[0].source.sha256 = "b".repeat(64);
  assert.throws(() => deriveTransition(second.previous, second.oldEdition, second.book), /entirely new/);
});

test("unchanged source hash cannot conceal changed visible text", () => {
  const {previous, oldEdition, book} = fixture();
  const block = book.chapters.find(c => c.id === "contents").blocks.find(b => b.type === "paragraph");
  block.text += " x"; delete block.runs;
  assert.throws(() => deriveTransition(previous, oldEdition, book), /identical block text/);
});

test("rewritten source receives new v9 identities including its notes", () => {
  const {previous, oldEdition, book} = fixture();
  const chapter = book.chapters.find(c => c.id === "chapter-01");
  chapter.source.sha256 = "b".repeat(64);
  const blocks = [...chapter.blocks, ...book.notes.filter(n => n.chapterId === chapter.id).flatMap(n => n.blocks)];
  for (const block of blocks) block.id = block.id.replace(/^manuscript-v[78]-/, "manuscript-v9-");
  const result = deriveTransition(previous, oldEdition, book);
  const transition = result.transitions.find(t => t.chapter_id === chapter.id);
  assert.equal(transition.action, "new-identities-no-annotation-transfer");
  assert.equal(transition.introduced_block_ids.length, blocks.length);
  assert.deepEqual(transition.retained_block_ids, []);
});

test("9.0 requires an explicit receipt before building editorial projection", () => {
  const {previous, book} = fixture();
  assert.throws(() => verifyTransition(root, book, Buffer.from(encode(previous))), /requires its explicit receipt/);
});
