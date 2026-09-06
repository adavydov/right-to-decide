import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { normalizeText, NORMALIZATION } from "../shared/open-editorial-text.mjs";

export const EDITION_PATTERN = "^[a-zA-Z0-9-]+(?:[.][a-zA-Z0-9-]+)*$";
export function assertEditionId(value) {
  if (typeof value !== "string" || value.length > 160 || !new RegExp(EDITION_PATTERN).test(value))
    throw new Error("Unsafe edition identifier.");
  return value;
}
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
export const encode = value => JSON.stringify(value, null, 2) + "\n";
const parse = bytes => JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
function local(root, relative) {
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative) || relative.includes("\\") || relative.split("/").some(part => !part || part === "." || part === ".."))
    throw new Error("Unsafe transition evidence path.");
  const resolved = path.resolve(root, relative), within = path.relative(root, resolved);
  if (!within || within.startsWith("..") || path.isAbsolute(within)) throw new Error("Transition evidence escapes repository.");
  return resolved;
}
export function fileRecord(root, relative) {
  return { path: relative, sha256: hash(fs.readFileSync(local(root, relative))) };
}
function checked(root, entry) {
  if (!entry || !/^[a-f0-9]{64}$/.test(entry.sha256 || "")) throw new Error("Missing exact transition evidence hash.");
  const bytes = fs.readFileSync(local(root, entry.path));
  assert.equal(hash(bytes), entry.sha256, "Transition evidence changed: " + entry.path);
  return bytes;
}
export function inventory(root, relative) {
  const directory = local(root, relative);
  const walk = (dir, prefix) => fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en")).flatMap(entry => {
    const filename = prefix + "/" + entry.name;
    if (entry.isDirectory()) return walk(path.join(dir, entry.name), filename);
    if (!entry.isFile()) throw new Error("Frozen snapshot contains an unsupported entry.");
    return [fileRecord(root, filename)];
  });
  return walk(directory, relative);
}
function blockText(block) {
  return normalizeText(block.type === "image" ? block.alt || "" : block.type === "table" ? block.rows.map(row => row.join("\t")).join("\n") : block.runs?.length ? block.runs.map(run => run.text).join("") : block.text);
}

export function deriveTransition(previous, oldEdition, book) {
  const chapters = book.chapters.filter(c => c.status === "available" && c.publicationStatus === "published" && c.id !== "source-contents");
  const oldById = new Map(oldEdition.chapters.map(chapter => [chapter.id, chapter]));
  assert.deepEqual(Object.keys(previous.chapters), oldEdition.chapters.map(chapter => chapter.id), "Historical identity map differs from its edition.");
  assert.deepEqual(chapters.map(c => c.id), oldEdition.chapters.map(c => c.id), "The transition must retain the published chapter selection.");
  const oldIds = new Set(oldEdition.chapters.flatMap(c => c.blocks.map(b => b.id)));
  const seen = new Set(), mapping = { schema_version: "1.0", chapters: {} }, transitions = [];
  for (const chapter of chapters) {
    if (!/^[a-zA-Z0-9-]+$/.test(chapter.id)) throw new Error("Unsafe chapter identifier.");
    const before = previous.chapters[chapter.id], oldChapter = oldById.get(chapter.id);
    assert.equal(before.source_sha256, oldChapter.source_sha256, "Historical chapter source changed.");
    assert.deepEqual(before.blocks, Object.fromEntries(oldChapter.blocks.map(block => [block.dom_id, block.id])), "Historical DOM mapping changed.");
    const source = chapter.source?.sha256 ?? chapter.sourceSha256;
    const sourceBlocks = [...chapter.blocks, ...book.notes.filter(n => n.chapterId === chapter.id).flatMap(n => n.blocks)];
    const changed = source !== before.source_sha256;
    const ids = {};
    for (const block of sourceBlocks) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(block.id)) throw new Error("Unsafe reader block identifier.");
      let stable;
      if (changed) {
        if (!block.id.startsWith((book.editionVersion === "8.0" ? "manuscript-v8-" : "manuscript-v7-") + chapter.id + "-") || oldIds.has(block.id))
          throw new Error("A rewritten chapter must have entirely new v7/v8 block identities.");
        stable = block.id;
      } else {
        stable = before.blocks[block.id];
        const oldBlock = oldChapter.blocks.find(item => item.dom_id === block.id && item.id === stable);
        if (!oldBlock || oldBlock.type !== block.type || oldBlock.snapshot_sha256 !== hash(NORMALIZATION + "\0" + blockText(block)))
          throw new Error("Unchanged chapter may retain only identical block text and identity.");
      }
      if (seen.has(stable)) throw new Error("Duplicate stable identity in the transition.");
      seen.add(stable); ids[block.id] = stable;
    }
    if (!changed) assert.deepEqual(ids, before.blocks, "Unchanged chapter lost or reordered blocks.");
    mapping.chapters[chapter.id] = { source_sha256: source, blocks: ids };
    transitions.push({ chapter_id: chapter.id, from_source_sha256: before.source_sha256, to_source_sha256: source,
      action: changed ? "new-identities-no-annotation-transfer" : "retain-identical-blocks",
      retired_block_ids: changed ? Object.values(before.blocks) : [],
      retained_block_ids: changed ? [] : Object.values(ids),
      introduced_block_ids: changed ? Object.values(ids) : [] });
  }
  if (book.editionVersion === "8.0") {
    assert.ok(transitions.some(item => item.chapter_id === "contents" && item.action === "retain-identical-blocks"), "The fixed contents must retain exact identities");
  } else {
    assert.deepEqual(transitions.filter(item => item.action === "retain-identical-blocks").map(item => item.chapter_id), ["contents"], "Only the unchanged contents retains identities in this literary rewrite.");
    assert.equal(transitions.filter(item => item.action === "new-identities-no-annotation-transfer").length, 20);
  }
  return { mapping, transitions };
}

export function verifyTransition(root, book, currentMapBytes) {
  const editionId = assertEditionId(book.releaseId);
  const receiptPath = "docs/open-editorial/identity-transitions/" + editionId + ".json";
  if (!fs.existsSync(local(root, receiptPath))) {
    if (["7.1", "8.0"].includes(book.editionVersion)) throw new Error("The literary identity transition requires its explicit receipt.");
    return parse(currentMapBytes);
  }
  const receipt = parse(fs.readFileSync(local(root, receiptPath)));
  assert.equal(receipt.schema_version, "1.0");
  assert.equal(receipt.to_edition_id, editionId);
  assert.equal(receipt.strategy, book.editionVersion === "8.0" ? "new-identities-for-source-revision" : "new-identities-for-literary-rewrite");
  assert.equal(receipt.annotation_transfer, "none");
  assertEditionId(receipt.from_edition_id);
  const bookBytes = checked(root, receipt.book);
  assert.deepEqual(parse(bookBytes), book, "Transition book differs from the selected projection.");
  const manifest = parse(checked(root, receipt.release_manifest));
  assert.equal(manifest.releaseId, editionId);
  assert.equal(manifest.bookSha256, hash(bookBytes));
  assert.equal(manifest.acceptanceStatus, "independent-editorial-review");
  assert.equal(manifest.published, true);
  for (const source of [manifest.prologue, ...manifest.chapters, manifest.authorContents]) checked(root, source);
  assert.equal(manifest.selection.path, receipt.publication_selection.path);
  assert.equal(manifest.selection.sha256, receipt.publication_selection.sha256);
  assert.equal(book.source.path, receipt.release_manifest.path);
  const selection = parse(checked(root, receipt.publication_selection));
  assert.equal(selection.editionVersion, book.editionVersion);
  assert.equal(selection.authorInstruction, book.editionVersion === "8.0" ? "пиши новую литературную редакцию и публикуй" : "Обнов сайт");
  for (const entry of selection.inputs) checked(root, entry);
  const oldMapBytes = checked(root, receipt.previous_identity_map), previous = parse(oldMapBytes);
  const oldCorpus = parse(checked(root, receipt.previous_corpus));
  assert.equal(oldCorpus.current_edition_id, receipt.from_edition_id);
  const oldEdition = parse(checked(root, receipt.previous_edition));
  assert.equal(oldEdition.id, receipt.from_edition_id);
  assert.deepEqual(oldCorpus.editions.find(e => e.id === oldEdition.id), oldEdition);
  assert.deepEqual(inventory(root, "public/editorial/editions/" + receipt.from_edition_id), receipt.frozen_files, "Published historical files changed.");
  if (book.editionVersion === "8.0") {
    assert.deepEqual(receipt.historical_editions?.map(e => e.id), oldCorpus.editions.map(e => e.id), "Historical edition inventory missing");
    for (const item of receipt.historical_editions) {
      assertEditionId(item.id);
      assert.deepEqual(inventory(root, "public/editorial/editions/" + item.id), item.files, "Historical snapshot changed: " + item.id);
    }
  }
  const derived = deriveTransition(previous, oldEdition, book);
  assert.deepEqual(receipt.chapter_transitions, derived.transitions, "Explicit chapter transition differs.");
  assert.equal(receipt.next_identity_map_sha256, hash(encode(derived.mapping)), "Reviewed target identity map differs.");
  const currentHash = hash(currentMapBytes);
  if (![hash(oldMapBytes), receipt.next_identity_map_sha256].includes(currentHash))
    throw new Error("Active identity map is neither the frozen source nor the reviewed target.");
  return derived.mapping;
}