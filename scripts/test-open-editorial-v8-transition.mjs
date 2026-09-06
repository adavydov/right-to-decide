import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { deriveTransition, verifyTransition, encode } from "./open-editorial-identity-transition.mjs";
import { NORMALIZATION } from "../shared/open-editorial-text.mjs";
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function fixture() {
  const ids = ["prologue", "contents", ...Array.from({length: 18}, (_, i) => "chapter-" + String(i + 1).padStart(2, "0")), "epilogue"];
  const previous = { schema_version: "1.0", chapters: {} };
  const oldEdition = { chapters: [] };
  const book = { editionVersion: "8.0", releaseId: "literary-manuscript-v8.0-test", notes: [], chapters: [] };
  for (const id of ids) {
    const oldId = id === "contents" ? "contents-p001" : "manuscript-v7-" + id + "-p001";
    previous.chapters[id] = { source_sha256: "old-" + id, blocks: {[oldId]: oldId} };
    oldEdition.chapters.push({id, source_sha256: "old-" + id, blocks: [{id: oldId, dom_id: oldId, type: "paragraph", snapshot_sha256: hash(NORMALIZATION + "\0" + "Before " + id)}]});
    book.chapters.push({id, status: "available", publicationStatus: "published",
      source: {sha256: (id === "contents" ? "old-" : "new-") + id},
      blocks: [{id: id === "contents" ? oldId : "manuscript-v8-" + id + "-p001", type: "paragraph", text: (id === "contents" ? "Before " : "After ") + id}]});
  }
  return {previous, oldEdition, book};
}
test("8.0 introduces fresh identities for all twenty rewritten sources", () => {
  const {previous, oldEdition, book} = fixture();
  const result = deriveTransition(previous, oldEdition, book);
  assert.equal(result.transitions.filter(t => t.action === "new-identities-no-annotation-transfer").length, 20);
  assert.deepEqual(result.transitions.filter(t => t.action === "retain-identical-blocks").map(t => t.chapter_id), ["contents"]);
});
test("8.0 rejects old or wrong-edition anchors on rewritten prose", () => {
  for (const id of ["manuscript-v7-prologue-p001", "manuscript-v7-prologue-new"]) {
    const {previous, oldEdition, book} = fixture();
    book.chapters[0].blocks[0].id = id;
    assert.throws(() => deriveTransition(previous, oldEdition, book), /entirely new/);
  }
});
test("unchanged source checksum cannot conceal changed contents", () => {
  const {previous, oldEdition, book} = fixture();
  book.chapters[1].blocks[0].text = "Changed without new source";
  assert.throws(() => deriveTransition(previous, oldEdition, book), /identical block text/);
});
test("8.0 requires its receipt even if a map already exists", t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "v8-transition-test-"));
  t.after(() => { const rel = path.relative(os.tmpdir(), folder); assert.ok(rel && !rel.startsWith("..") && !path.isAbsolute(rel)); fs.rmSync(folder, {recursive: true, force: true}); });
  const {previous, book} = fixture();
  assert.throws(() => verifyTransition(folder, book, Buffer.from(encode(previous))), /explicit receipt/);
});

test("8.0 preserves an unchanged chapter while nineteen sources receive fresh identities", () => {
  const {previous, oldEdition, book} = fixture();
  const chapter = book.chapters.find(item => item.id === "chapter-07");
  chapter.source.sha256 = "old-chapter-07";
  chapter.blocks = [{id: "manuscript-v7-chapter-07-p001", type: "paragraph", text: "Before chapter-07"}];
  const result = deriveTransition(previous, oldEdition, book);
  assert.equal(result.transitions.filter(t => t.action === "new-identities-no-annotation-transfer").length, 19);
  assert.deepEqual(result.transitions.filter(t => t.action === "retain-identical-blocks").map(t => t.chapter_id), ["contents", "chapter-07"]);
  chapter.blocks[0].text += " concealed change";
  assert.throws(() => deriveTransition(previous, oldEdition, book), /identical block text/);
});
