import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { assertEditionId, EDITION_PATTERN, deriveTransition, verifyTransition, encode } from "./open-editorial-identity-transition.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(root, relative));
const json = relative => JSON.parse(read(relative).toString("utf8").replace(/^\uFEFF/, ""));
const book = json("src/data/book.json");
const receiptPath = "docs/open-editorial/identity-transitions/" + book.releaseId + ".json";
const receipt = json(receiptPath);
const previous = json(receipt.previous_identity_map.path), oldEdition = json(receipt.previous_edition.path);
const currentMap = read("docs/open-editorial/block-identities.json");
function changeRead(t, relative, transform) {
  const original = fs.readFileSync;
  t.mock.method(fs, "readFileSync", (file, ...args) => {
    const result = original(file, ...args);
    return path.resolve(String(file)) === path.resolve(root, relative) ? transform(result) : result;
  });
}

test("dotted edition identity is a single safe path component in code and OpenAPI", () => {
  for (const id of ["literary-manuscript-v6-67b660773c98", "literary-manuscript-v7.1-163743358797"])
    assert.equal(assertEditionId(id), id);
  for (const id of [".", "..", "a..b", "../edition", "edition/one", "edition\\one", "%2e%2e", "a%2fb", "a?x=1", "a#b", "a.b.", "" ]) {
    assert.throws(() => assertEditionId(id), /Unsafe edition/);
    assert.equal(new RegExp(EDITION_PATTERN).test(id), false);
  }
});

test("reviewed rewrite introduces 450 fresh IDs and retains only 46 identical contents blocks", () => {
  const { mapping, transitions } = deriveTransition(previous, oldEdition, book);
  assert.deepEqual(transitions.filter(c => c.action === "retain-identical-blocks").map(c => c.chapter_id), ["contents"]);
  assert.equal(transitions.filter(c => c.action === "new-identities-no-annotation-transfer").length, 20);
  assert.equal(transitions.reduce((sum, c) => sum + c.introduced_block_ids.length, 0), 450);
  assert.equal(transitions.reduce((sum, c) => sum + c.retained_block_ids.length, 0), 46);
  const oldIds = new Set(oldEdition.chapters.flatMap(c => c.blocks.map(b => b.id)));
  for (const item of transitions) for (const id of item.introduced_block_ids) assert.equal(oldIds.has(id), false);
  assert.deepEqual(mapping, JSON.parse(currentMap));
});

test("exact receipt accepts the frozen old map or installed new map without changing either", () => {
  const oldBytes = read(receipt.previous_identity_map.path), oldCopy = Buffer.from(oldBytes), currentCopy = Buffer.from(currentMap);
  assert.deepEqual(verifyTransition(root, book, oldBytes), verifyTransition(root, book, currentMap));
  assert.deepEqual(oldBytes, oldCopy); assert.deepEqual(currentMap, currentCopy);
});

test("rewritten paragraph cannot inherit a historical annotation identity", () => {
  const changed = structuredClone(book);
  changed.chapters.find(c => c.id === "prologue").blocks[0].id = oldEdition.chapters.find(c => c.id === "prologue").blocks[0].id;
  assert.throws(() => deriveTransition(previous, oldEdition, changed), /entirely new v7/);
});

test("retained contents identity cannot hide changed text under the same source checksum", () => {
  const changed = structuredClone(book), block = changed.chapters.find(c => c.id === "contents").blocks[0];
  block.text += " Изменение."; delete block.runs;
  assert.throws(() => deriveTransition(previous, oldEdition, changed), /identical block text/);
});

test("missing receipt cannot be bypassed by an already installed matching identity map", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oe-identity-missing-"));
  t.after(() => { const rel = path.relative(os.tmpdir(), dir); assert.ok(rel && !rel.startsWith("..") && !path.isAbsolute(rel)); fs.rmSync(dir, { recursive: true, force: true }); });
  assert.throws(() => verifyTransition(dir, book, currentMap), /requires its explicit receipt/);
});

test("arbitrary active map changes are rejected rather than silently regenerated", () => {
  const changed = JSON.parse(currentMap);
  delete changed.chapters.prologue.blocks[Object.keys(changed.chapters.prologue.blocks)[0]];
  assert.throws(() => verifyTransition(root, book, Buffer.from(encode(changed))), /neither the frozen source nor the reviewed target/);
});

test("modified accepted chapter Markdown invalidates the transition before import", t => {
  const manifest = json(receipt.release_manifest.path);
  const source = manifest.chapters.find(item => item.id === "chapter-01");
  assert.ok(source);
  changeRead(t, source.path, bytes => Buffer.concat([bytes, Buffer.from("changed")]));
  assert.throws(() => verifyTransition(root, book, currentMap), /Transition evidence changed/);
});

test("a modified pinned independent review invalidates the transition", t => {
  const selection = json(receipt.publication_selection.path);
  const review = selection.inputs.find(item => item.path.endsWith("independent-review.md"));
  assert.ok(review);
  changeRead(t, review.path, bytes => Buffer.concat([bytes, Buffer.from("changed")]));
  assert.throws(() => verifyTransition(root, book, currentMap), /Transition evidence changed/);
});

test("a modified published v6 snapshot invalidates the transition", t => {
  const snapshot = receipt.frozen_files.find(item => item.path.endsWith(".txt"));
  assert.ok(snapshot);
  changeRead(t, snapshot.path, bytes => Buffer.concat([bytes, Buffer.from("changed")]));
  assert.throws(() => verifyTransition(root, book, currentMap), /Published historical files changed/);
});

test("receipt cannot claim a different transfer decision", t => {
  changeRead(t, receiptPath, () => Buffer.from(encode({ ...receipt, annotation_transfer: "automatic" })));
  assert.throws(() => verifyTransition(root, book, currentMap));
});