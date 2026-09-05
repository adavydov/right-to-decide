import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { siteConfig } from "../src/lib/site-config.ts";

const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const book = readJSON("src/data/book.json");
const authors = readJSON("src/data/authors.json").authors;
const sources = readJSON("src/data/library.json").sources;
const cards = readJSON("src/data/evidence-cards.json").cards;
const publicRoot = path.resolve("public");
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const nonempty = (value, label) =>
  assert.ok(typeof value === "string" && value.trim(), label + " must be nonempty");

function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    assert.match(item.id, idPattern, label + " has an invalid ID");
    assert.ok(!ids.has(item.id), "Duplicate " + label + " ID: " + item.id);
    ids.add(item.id);
  }
  return ids;
}

function safeURL(value, label) {
  nonempty(value, label);
  assert.ok(!/[\u0000-\u0020\\]/u.test(value), "Unsafe URL in " + label);
  assert.ok(!value.startsWith("//"), "Protocol-relative URL in " + label);
  const local = value.startsWith("/") || value.startsWith("#");
  if (local) {
    let decoded;
    assert.doesNotThrow(() => { decoded = decodeURIComponent(value); }, "Malformed URL in " + label);
    assert.ok(!decoded.includes("\\") && !decoded.split(/[/?#]/).includes(".."), "Unsafe local URL in " + label);
    return;
  }
  let url;
  assert.doesNotThrow(() => { url = new URL(value); }, "Invalid URL in " + label);
  assert.ok(["https:", "http:", "mailto:"].includes(url.protocol), "Unsafe protocol in " + label);
  assert.ok(!url.username && !url.password, "Credentials in URL: " + label);
}

function localMedia(src, label) {
  safeURL(src, label);
  assert.ok(src.startsWith("/") && !src.startsWith("//"), "Media must use a public path: " + label);
  const file = path.resolve(publicRoot, "." + decodeURIComponent(src.split(/[?#]/)[0]));
  assert.ok(file.startsWith(publicRoot + path.sep), "Media escapes public/: " + label);
  assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), "Missing media: " + src);
}

assert.ok([1, 2].includes(book.schemaVersion), "Unsupported book schema");
assert.equal(book.title, "Право на решение");
nonempty(book.subtitle, "Book subtitle");
nonempty(siteConfig.subtitle, "Site subtitle");
// DOCX is a preserved author edition; its original subtitle need not match the new site preview.
if (book.schemaVersion === 2) assert.equal(book.subtitle, siteConfig.subtitle, "Markdown release/site subtitle mismatch");
assert.equal(book.parts.length, 6, "The selected edition must retain its six parts");
const mainChapters = book.chapters.filter((chapter) => chapter.kind === "chapter");
assert.equal(mainChapters.length, 18, "The selected edition must retain its eighteen chapter entries");
uniqueIds(book.parts, "part");
const chapterIds = uniqueIds(book.chapters, "chapter");
assert.deepEqual(mainChapters.map((chapter) => Number(chapter.number)), Array.from({ length: 18 }, (_, index) => index + 1));
assert.ok(book.chapters.some((chapter) => chapter.id === "preface" && chapter.status === "available"), "Missing available preface");
assert.equal(authors.length, 3);
uniqueIds(authors, "author");
assert.ok(Array.isArray(book.notes), "Book notes must be an array");
const noteIds = uniqueIds(book.notes, "note");
const notesById = new Map(book.notes.map((note) => [note.id, note]));
const chapterById = new Map(book.chapters.map((chapter) => [chapter.id, chapter]));
const renderedIds = new Set(noteIds);
const references = new Map();
let blockCount = 0;

function claimId(id, label) {
  assert.match(id, idPattern, "Invalid anchor in " + label);
  assert.ok(!renderedIds.has(id), "Duplicate rendered ID: " + id);
  renderedIds.add(id);
}

function validateBlock(block, chapterId) {
  claimId(block.id, chapterId);
  blockCount++;
  assert.ok(["paragraph", "heading", "table", "image"].includes(block.type), "Unknown block type: " + block.id);
  if (block.type === "image") {
    localMedia(block.src, block.id);
    nonempty(block.alt, "Image alt: " + block.id);
    return;
  }
  if (block.type === "table") {
    assert.ok(Array.isArray(block.rows) && block.rows.length, "Empty table: " + block.id);
    assert.ok(block.rows.every((row) => Array.isArray(row) && row.length && row.every((cell) => typeof cell === "string")), "Invalid table cells: " + block.id);
    return;
  }
  assert.equal(typeof block.text, "string", "Missing text: " + block.id);
  if (block.runs !== undefined) {
    assert.ok(Array.isArray(block.runs), "Invalid runs: " + block.id);
    assert.equal(block.runs.map((run) => run.text).join(""), block.text, "Inline text differs from block text: " + block.id);
    block.runs.forEach((run, index) => {
      assert.equal(typeof run.text, "string", "Missing run text: " + block.id);
      if (run.href !== undefined) safeURL(run.href, block.id);
      if (run.noteId) {
        assert.ok(noteIds.has(run.noteId), "Undefined note " + run.noteId + " in " + block.id);
        const note = notesById.get(run.noteId);
        if (note.chapterId) assert.equal(note.chapterId, chapterId, "Note belongs to another chapter: " + run.noteId);
        claimId(block.id + "-ref-" + index, block.id);
        references.set(run.noteId, (references.get(run.noteId) || 0) + 1);
      }
    });
  }
}

for (const chapter of book.chapters) {
  nonempty(chapter.title, "Chapter title: " + chapter.id);
  assert.ok(["available", "planned"].includes(chapter.status), "Invalid chapter status: " + chapter.id);
  assert.ok(Array.isArray(chapter.blocks), "Invalid chapter blocks: " + chapter.id);
  if (chapter.status === "available") assert.ok(chapter.blocks.length, "Available chapter is empty: " + chapter.id);
  else assert.equal(chapter.blocks.length, 0, "Planned chapter contains text: " + chapter.id);
  if (book.schemaVersion === 2 && book.notes.some((note) => note.chapterId === chapter.id)) {
    nonempty(chapter.notesHeading, "Preserved notes heading: " + chapter.id);
  }
  for (const block of chapter.blocks) validateBlock(block, chapter.id);
}
for (const note of book.notes) {
  assert.ok(["footnote", "endnote"].includes(note.kind), "Invalid note kind: " + note.id);
  assert.ok(Array.isArray(note.blocks) && note.blocks.length, "Empty note: " + note.id);
  if (book.schemaVersion === 2) {
    assert.ok(chapterIds.has(note.chapterId), "Unknown note chapter: " + note.id);
    assert.equal(chapterById.get(note.chapterId).status, "available", "Note belongs to a planned chapter: " + note.id);
  }
  for (const block of note.blocks) validateBlock(block, note.chapterId);
}
for (const note of book.notes) assert.ok(references.has(note.id), "Note has no reference: " + note.id);

for (const author of authors) {
  nonempty(author.name, "Author name");
  nonempty(author.bio, "Author biography: " + author.id);
  nonempty(author.role, "Author role: " + author.id);
  for (const link of author.links || []) safeURL(link.url, author.id);
  if (author.photo) {
    localMedia(author.photo.src, author.id);
    if (author.photo.sourceUrl) safeURL(author.photo.sourceUrl, author.id);
  }
}
localMedia(siteConfig.coverPath, "Book cover");
assert.equal(siteConfig.coverPath, "/images/book-cover-new-subtitle.png");

assert.equal(sources.length, 48, "Incomplete selected public bibliography");
assert.equal(cards.length, 30, "Incomplete selected public card collection");
const sourceIds = uniqueIds(sources, "library source");
const cardIds = uniqueIds(cards, "evidence card");
const cardsById = new Map(cards.map((card) => [card.id, card]));
for (const source of sources) {
  nonempty(source.title, "Source title: " + source.id);
  assert.ok(Array.isArray(source.authors) && source.authors.every((author) => typeof author === "string"), "Missing source authors: " + source.id);
  nonempty(source.edition, "Source edition: " + source.id);
  assert.ok(Array.isArray(source.links), "Missing source links: " + source.id);
  for (const link of source.links) safeURL(link.url, source.id);
  assert.ok(Array.isArray(source.cardIds), "Missing card list: " + source.id);
  assert.equal(new Set(source.cardIds).size, source.cardIds.length, "Repeated source/card link: " + source.id);
  for (const id of source.cardIds) {
    assert.ok(cardIds.has(id), "Unknown linked card: " + id);
    assert.equal(cardsById.get(id).sourceId, source.id, "Mismatched source/card link: " + id);
  }
}
for (const card of cards) {
  assert.ok(sourceIds.has(card.sourceId), "Unknown source: " + card.id);
  assert.ok(sources.find((source) => source.id === card.sourceId).cardIds.includes(card.id), "Missing source backlink: " + card.id);
  for (const field of ["title", "context", "observation", "interpretation"]) nonempty(card[field], card.id + " " + field);
  assert.ok(Array.isArray(card.quotes) && card.quotes.length, "No quotes: " + card.id);
  assert.ok(Array.isArray(card.limits) && card.limits.length, "No limits: " + card.id);
  assert.ok(Array.isArray(card.paragraphIds) && card.paragraphIds.length, "No source locators: " + card.id);
  for (const quote of card.quotes) {
    nonempty(quote.text, "Quote: " + card.id);
    nonempty(quote.attribution, "Quote attribution: " + card.id);
    assert.ok(Array.isArray(quote.paragraphIds) && quote.paragraphIds.length, "Quote lacks locator: " + card.id);
    for (const id of quote.paragraphIds) assert.ok(card.paragraphIds.includes(id), "Quote outside card locator: " + card.id);
  }
}

console.log("Content passed: schema " + book.schemaVersion + "; " +
  mainChapters.filter((chapter) => chapter.status === "available").length + "/" + mainChapters.length +
  " available chapters; " + blockCount + " blocks; " + book.notes.length + " notes; " +
  authors.length + " authors; " + sources.length + " sources; " + cards.length + " cards.");
