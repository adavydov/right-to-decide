import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertEditionId, deriveTransition, verifyTransition, inventory, fileRecord, encode } from "./open-editorial-identity-transition.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checking = process.argv.includes("--check");
const read = relative => fs.readFileSync(path.join(root, relative));
const json = relative => JSON.parse(read(relative).toString("utf8").replace(/^\uFEFF/, ""));
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function immutable(relative, bytes) {
  const target = path.join(root, relative);
  if (fs.existsSync(target)) assert.deepEqual(read(relative), bytes, "Frozen transition artifact differs: " + relative);
  else {
    assert.equal(checking, false, "Missing transition artifact: " + relative);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes);
  }
}
const book = json("src/data/book.json");
assert.equal(book.editionVersion, "9.0", "Prepare the accepted 9.0 projection first");
// Validate all accepted source bytes and outputs before freezing any transition files.
execFileSync(process.env.PYTHON || "python", ["scripts/publish-manuscript.py", "--edition", "v9", "--check"],
  { cwd: root, windowsHide: true, stdio: "pipe" });
const editionId = assertEditionId(book.releaseId);
const mapPath = "docs/open-editorial/block-identities.json";
const receiptPath = "docs/open-editorial/identity-transitions/" + editionId + ".json";
if (fs.existsSync(path.join(root, receiptPath))) {
  verifyTransition(root, book, read(mapPath));
  console.log("V9 IDENTITY RECEIPT CHECK OK: " + editionId);
} else {
  assert.equal(checking, false, "Missing explicit transition receipt");
  const corpus = json("public/editorial/corpus.json");
  const from = assertEditionId(corpus.current_edition_id);
  assert.notEqual(from, editionId, "Freeze the previous corpus before replacing it");
  const oldEditionPath = "public/editorial/editions/" + from + "/edition.json";
  const oldEdition = json(oldEditionPath);
  const previous = json(mapPath);
  const derived = deriveTransition(previous, oldEdition, book);
  const manifestPath = book.source.path;
  const manifest = json(manifestPath);
  assert.equal(manifest.editionVersion, "9.0");
  assert.equal(manifest.acceptanceStatus, "independent-editorial-review");
  assert.equal(manifest.bookSha256, hash(read("src/data/book.json")));
  const archive = "docs/open-editorial/identity-transitions/archives/" + from;
  immutable(archive + "/block-identities.json", read(mapPath));
  immutable(archive + "/corpus.json", read("public/editorial/corpus.json"));
  const receipt = {
    schema_version: "1.0", from_edition_id: from, to_edition_id: editionId, created: book.edition,
    strategy: "new-identities-for-source-revision", annotation_transfer: "none",
    author_instruction: "Ну все, все готово, пересобирай книгу и публикуй все",
    review_scope: "Technical transition of accepted source bytes. Identical sources retain exact prior blocks; changed and separately accepted added sources receive new IDs. No annotation transfer or claim that every chapter was rewritten is made.",
    book: fileRecord(root, "src/data/book.json"),
    release_manifest: fileRecord(root, manifestPath),
    publication_selection: fileRecord(root, manifest.selection.path),
    previous_identity_map: fileRecord(root, archive + "/block-identities.json"),
    previous_corpus: fileRecord(root, archive + "/corpus.json"),
    previous_edition: fileRecord(root, oldEditionPath),
    frozen_files: inventory(root, "public/editorial/editions/" + from),
    historical_editions: corpus.editions.map(e => ({id: assertEditionId(e.id), files: inventory(root, "public/editorial/editions/" + e.id)})),
    chapter_transitions: derived.transitions,
    next_identity_map_sha256: hash(encode(derived.mapping))
  };
  immutable(receiptPath, Buffer.from(encode(receipt)));
  verifyTransition(root, book, read(mapPath));
  console.log("V9 IDENTITY RECEIPT PREPARED: " + editionId);
}
