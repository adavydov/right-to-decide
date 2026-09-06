import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { siteConfig } from "../src/lib/site-config.ts";

const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const book = readJSON("src/data/book.json");
const archive = readJSON("src/data/previous-edition.json");
const manifest = readJSON("manuscript/2026-09-05-rebuild/contents-v5.1-manifest.json");
const isV6 = book.editionVersion === "6.0";
const isV7 = ["7.0", "7.1"].includes(book.editionVersion);
const isReviewed = isV6 || isV7;
const v7SourceRoot = book.editionVersion === "7.1"
  ? "manuscript/2026-09-06-davydov-cases" : "manuscript/2026-09-06-critic-revision";
const literaryManifest = book.contentKind === "manuscript"
  ? readJSON(isV7 ? `${v7SourceRoot}/release-manifest.json` : isV6 ? "manuscript/2026-09-05-rebuild/chapters-v6/release-manifest.json" : "manuscript/2026-09-05-rebuild/chapters-v4/release-manifest.json") : null;
const sha = (raw) => createHash("sha256").update(raw).digest("hex");
const authors = readJSON("src/data/authors.json").authors;
const teamCatalog = readJSON("src/data/editorial-team.json");
assert.equal(teamCatalog.version, "4.0", "Use the current literary role catalog");
assert.deepEqual(teamCatalog, readJSON("docs/editorial/editorial-team-v4.0.json"), "Public literary roles differ from the current editorial contract");
assert.equal(teamCatalog.groups.find(group => group.id === "nine-layers")?.roles.length, 9, "Keep all nine layer competencies");

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
assert.equal(book.schemaVersion, 2);
assert.ok(["outline", "manuscript"].includes(book.contentKind));
assert.equal(book.version, "5.1");
const releasedChapters = mainChapters.filter(c => c.status === "available");
const plannedChapters = mainChapters.filter(c => c.status === "planned");
assert.deepEqual(book.chapters.filter(c => c.status === "available").map(c => c.id),
  ["prologue", "contents", ...releasedChapters.map(c => c.id), ...(isReviewed && literaryManifest?.includesEpilogue ? ["epilogue"] : [])]);
assert.equal(book.statistics.availableChapters, releasedChapters.length);
assert.equal(book.statistics.plannedChapters, plannedChapters.length);
if (literaryManifest) {
  assert.ok(releasedChapters.length, "A manuscript release must contain a numbered chapter");
  assert.equal(literaryManifest.schemaVersion, isV7 ? 3 : isV6 ? 2 : 1);
  assert.equal(literaryManifest.architectureVersion, "5.1");
  assert.equal(literaryManifest.acceptanceStatus, isReviewed ? "independent-editorial-review" : "published-texts-pending-constitution-review");
  assert.equal(literaryManifest.releaseId, book.releaseId);
  assert.deepEqual(literaryManifest.chapterNumbers, releasedChapters.map(c => c.number));
  assert.deepEqual(literaryManifest.chapters,
    book.chapters.filter(c => c.status === "available" && (c.kind === "chapter" || c.id === "epilogue")).map(c => ({ id: c.id, number: c.number, ...c.source })));
  assert.equal(literaryManifest.bookSha256, sha(fs.readFileSync("src/data/book.json")));
  assert.deepEqual(literaryManifest.archive, manifest.archive);
  for (const chapter of releasedChapters) {
    assert.equal(chapter.contentKind, "manuscript");
    assert.equal(chapter.publicationStatus, "published");
    if (!isV7) assert.equal(chapter.source.path, `manuscript/2026-09-05-rebuild/chapters-${isV6 ? "v6" : "v4"}/${chapter.id}.md`);
    else assert.ok(chapter.source.path.startsWith("manuscript/2026-09-06-") && !chapter.source.path.split("/").includes(".."), "Unexpected literary source path");
    assert.equal(sha(fs.readFileSync(chapter.source.path)), chapter.source.sha256, "Chapter source checksum: " + chapter.id);
  }
} else {
  assert.equal(releasedChapters.length, 0, "Outline-only release cannot contain new prose");
}
assert.ok(!book.chapters.some(c => c.id === "preface"), "Replaced preface is still active");
assert.equal(book.chapters.length, 21);
const epilogue = book.chapters.at(-1);
assert.equal(epilogue.id, "epilogue");
assert.equal(epilogue.title, "Эпилог. Следующий вопрос — не наш");
assert.equal(epilogue.kind, "backmatter");
assert.equal(epilogue.status, isReviewed && literaryManifest?.includesEpilogue ? "available" : "planned", "Epilogue availability must match the explicit release");
assert.equal(manifest.checks.separateEpilogue, true);
assert.equal(manifest.constitution.sha256, sha(fs.readFileSync("CONSTITUTION.md")));
assert.deepEqual(book.parts.map(p => p.number), ["I", "II", "III", "IV", "V", "VI"]);
for (const part of book.parts) {
  assert.equal(mainChapters.filter(c => c.part === part.title).length, 3, "Each part must contain three chapters");
  assert.ok(Array.isArray(part.description), "Missing part description collection");
  assert.ok(mainChapters.filter(c => c.part === part.title).every(c => c.summary), "Missing constitutional chapter function");
}
const prologue = book.chapters.find(c => c.id === "prologue");
const contents = book.chapters.find(c => c.id === "contents");
assert.equal(prologue.title, isV7 ? "Пролог. Право на решение" : "Пролог");
assert.equal(prologue.version, isV7 ? "7.0" : isV6 ? literaryManifest.prologueSelection.version : "1.0");
if (!isReviewed) {
  assert.equal(prologue.blocks.length, 65);
  assert.equal(prologue.blocks.filter(b => b.text === "⸻").length, 4);
} else if (isV6) {
  assert.equal(prologue.source.path, literaryManifest.prologueSelection.path);
  assert.equal(sha(fs.readFileSync(prologue.source.path)), prologue.source.sha256);
  assert.equal(literaryManifest.masterPrologue.path, "manuscript/2026-09-05-rebuild/prologue-v2.0.md");
  assert.equal(sha(fs.readFileSync(literaryManifest.masterPrologue.path)), literaryManifest.masterPrologue.sha256);
  if (prologue.version !== "2.0") {
    assert.equal(literaryManifest.prologueSelection.status, "accepted");
    assert.equal(literaryManifest.prologueSelection.sha256, prologue.source.sha256);
    assert.ok(literaryManifest.reviews.some(review => review.id === "prologue"), "Prologue addition needs its independent review");
  }
  assert.ok(prologue.blocks.some(b => b.runs?.some(r => r.href)), "Master prologue source links are missing");
}
assert.equal(contents.blocks.length, 46, "Reader outline contains 20 headings and summaries, plus six part headings");
assert.equal(contents.blocks.filter(block => block.type === "paragraph").length, 20, "Each reader section has one paragraph");
if (!isV7) assert.equal(book.notes.length, 0, "Legacy selected edition has no notes");
for (const chapter of isReviewed ? [contents] : [prologue, contents]) {
  const raw = fs.readFileSync(chapter.source.path);
  assert.equal(sha(raw), chapter.source.sha256, "Author source checksum: " + chapter.id);
  const chunks = raw.toString("utf8").replace(/^\uFEFF/, "").trim().split(/\n\s*\n/u);
  const body = chunks.slice(chapter.id === "prologue" ? 1 : 2).map(text => text.replace(/^#{2,3} /u, "").trim());
  assert.deepEqual(chapter.blocks.map(b => b.text), body, "Author text/order changed: " + chapter.id);
}
if (!isReviewed) {
  assert.equal(prologue.source.sha256, "9c01d468a874bc58d7ee56da3a3130748c90eddd9ff7908fc327332afed32288");
  assert.ok(prologue.blocks.every(b => b.type === "paragraph" && !b.runs?.some(r => r.href || r.noteId)), "Source links in legacy prologue");
}
assert.equal(sha(fs.readFileSync("public/book/contents-v5.1.md")), contents.source.sha256, "Contents download differs");
if (!isReviewed) assert.deepEqual(manifest.prologue, prologue.source);
assert.deepEqual(manifest.authorSource, contents.source);
if (!literaryManifest) assert.equal(manifest.bookSha256, sha(fs.readFileSync("src/data/book.json")));
else {
  assert.deepEqual(literaryManifest.prologue, prologue.source);
  assert.deepEqual(literaryManifest.authorContents, contents.source);
}
assert.equal(manifest.archive.sha256, sha(fs.readFileSync("src/data/previous-edition.json")));
assert.equal(manifest.archive.sha256, "61b6b6d314f7148798a68170f13fad55223e7d9713938ab18b79aca12685ee35", "Previous edition snapshot changed");
assert.equal(archive.chapters.length, 38);
assert.equal(archive.chapters.filter(c => c.kind === "chapter").length, 18);
assert.equal(archive.chapters.filter(c => c.id !== "source-contents" && c.status === "available").length, 37);
if (isReviewed) {
  const downloadable = book.chapters.filter(c => c.status === "available" && c.contentKind === "manuscript");
  assert.deepEqual(literaryManifest.downloads.map(d => d.id), downloadable.map(c => c.id));
  for (const chapter of downloadable) {
    assert.match(chapter.download?.docx || "", /^\/book\/chapters\/(?:chapter-\d{2}|prologue|epilogue)-v[\d.]+\.docx$/u);
    localMedia(chapter.download.docx, chapter.id + " DOCX");
    const raw = fs.readFileSync("public" + chapter.download.docx);
    assert.equal(raw.subarray(0, 2).toString(), "PK", "Download is not an OOXML package");
    assert.equal(raw.length, chapter.download.bytes);
    assert.equal(sha(raw), chapter.download.sha256, "DOCX checksum: " + chapter.id);
    assert.equal(sha(fs.readFileSync(chapter.source.path)), chapter.source.sha256);
    const item = literaryManifest.downloads.find(d => d.id === chapter.id);
    assert.equal(item.sha256, chapter.download.sha256);
    assert.equal(item.sourceSha256, chapter.source.sha256);
  }
}
if (isV7) {
  assert.equal(book.source.path, `${v7SourceRoot}/release-manifest.json`);
  assert.equal(literaryManifest.includesEpilogue, true);
  const texts = book.chapters.filter(c => c.status === "available" && c.contentKind === "manuscript");
  assert.equal(texts.length, 20, "Edition 7 must publish the prologue, eighteen chapters and epilogue");
  assert.equal(literaryManifest.downloads.length, 20, "Every literary section needs its own Word file");
  for (const chapter of texts) {
    assert.match(chapter.version, /^7\.[01]$/u);
    assert.equal(sha(fs.readFileSync(chapter.source.path)), chapter.source.sha256, "Selected section source checksum: " + chapter.id);
    assert.ok(chapter.blocks.every(block => block.id.startsWith(`manuscript-v7-${chapter.id}-`)), "Wrong edition anchors: " + chapter.id);
  }
  assert.equal(book.notes.length, book.editionVersion === "7.1" ? 22 : 20, "All selected literary source notes must remain available");
  assert.ok(book.chapters.find(c => c.id === "chapter-16").blocks.some(b => b.type === "table"), "Chapter 16 lost its model budget table");
  assert.deepEqual(Object.keys(book.downloads).sort(), ["docx", "pdf"]);
  assert.equal(literaryManifest.readingDownloads.length, 2);
  for (const format of ["docx", "pdf"]) {
    const item = book.downloads[format];
    assert.equal(item.path, `/book/right-to-decide-v${book.editionVersion === "7.0" ? "7" : "7.1"}.${format}`);
    localMedia(item.path, "Whole-book " + format);
    const raw = fs.readFileSync("public" + item.path);
    assert.equal(raw.length, item.bytes);
    assert.equal(sha(raw), item.sha256, "Whole-book checksum: " + format);
    assert.equal(raw.subarray(0, format === "pdf" ? 5 : 2).toString(), format === "pdf" ? "%PDF-" : "PK");
    assert.ok(literaryManifest.readingDownloads.some(d => d.sha256 === item.sha256), "Reading download missing in release manifest: " + format);
  }
}
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
    if (block.cellRuns) {
      assert.equal(block.cellRuns.length, block.rows.length, "Table formatting row count: " + block.id);
      block.rows.forEach((row, ri) => {
        assert.equal(block.cellRuns[ri].length, row.length, "Table formatting cell count: " + block.id);
        row.forEach((cell, ci) => {
          const runs = block.cellRuns[ri][ci];
          assert.equal(runs.map(run => run.text).join(""), cell, "Table inline text mismatch: " + block.id);
          for (const run of runs) {
            if (run.href !== undefined) safeURL(run.href, block.id);
            assert.ok(!run.noteId, "Table note references require a dedicated source mapping: " + block.id);
          }
        });
      });
    }
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

const activeBlockCount = blockCount;
uniqueIds(archive.chapters, "archive chapter");
for (const chapter of archive.chapters) {
  nonempty(chapter.title, "Archive title: " + chapter.id);
  assert.equal(chapter.status, "available", "Archived section lost its text");
  assert.ok(chapter.blocks.length, "Empty archive section: " + chapter.id);
  for (const block of chapter.blocks) validateBlock(block, chapter.id);
}
assert.equal(book.statistics.blocks, activeBlockCount);
assert.equal(archive.statistics.blocks, blockCount - activeBlockCount);

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
assert.equal(siteConfig.coverPath, "/images/book-cover-digital-v1.webp");

const librarySupplement = readJSON("src/data/library-supplement.json");
assert.equal(librarySupplement.schemaVersion, 1);
assert.deepEqual(librarySupplement.sources.map(source => [source.id, source.number]),
  [["source-49", 49], ["source-50", 50]], "Unexpected approved metadata sources");
assert.ok(librarySupplement.sources.every(source => source.cardIds.length === 0 && source.links.length === 0),
  "Metadata supplement must not export private cards or files");
assert.equal(sources.length, 48 + librarySupplement.sources.length, "Incomplete selected public bibliography");
assert.deepEqual(sources.slice(0, 48).map(source => source.number), Array.from({ length: 48 }, (_, i) => i + 1));
assert.deepEqual(sources.slice(48), librarySupplement.sources, "Approved bibliography supplement differs");
assert.ok(readJSON("src/data/library.json").asOf >= librarySupplement.asOf, "Library date precedes its supplement");
assert.equal(cards.length, 97, "The public collection must retain 30 cards and add 67 Chertok cards");
const chertokCards = cards.filter(card => card.sourceId === "source-01");
const chertokSource = sources.find(source => source.id === "source-01");
assert.ok(chertokSource, "Missing Russian Chertok source");
assert.deepEqual(chertokSource.languages, ["ru"], "Chertok must use only the Russian originals");
assert.deepEqual(chertokSource.links, [], "Private Chertok originals must not become download links");
assert.equal(chertokSource.availability, "provided");
assert.equal(chertokSource.reading, "not-claimed", "Selected Chertok fragments are not a full close reading");
nonempty(chertokSource.readingNote, "Chertok reading scope");
assert.equal(chertokCards.length, 67, "Incomplete Russian Chertok collection");
assert.equal(chertokCards.reduce((total, card) => total + card.quotes.length, 0), 99, "Unexpected Chertok quote count");
const chertokVolumes = [
  { volume: 1, cards: 19, pages: 294 },
  { volume: 2, cards: 16, pages: 298 },
  { volume: 3, cards: 16, pages: 398 },
  { volume: 4, cards: 16, pages: 437 },
];
for (const { volume, cards: count, pages } of chertokVolumes) {
  const prefix = `CHERTOKRU-PDF-V${volume}`;
  const volumeCards = chertokCards.filter(card => card.id.startsWith(prefix + "-C"));
  assert.deepEqual(volumeCards.map(card => card.id).sort(),
    Array.from({ length: count }, (_, index) => `${prefix}-C${String(index + 1).padStart(2, "0")}`),
    "Unexpected Chertok card IDs in volume " + volume);
  for (const card of volumeCards) {
    assert.equal(card.locatorKind, "pdf-page", "Chertok locators must be PDF pages: " + card.id);
    nonempty(card.locatorNote, "PDF pagination note: " + card.id);
    for (const id of card.paragraphIds) {
      const match = id.match(new RegExp(`^${prefix}:PDF(\\d{4})$`));
      assert.ok(match, "Wrong volume or invalid PDF locator: " + id);
      assert.ok(Number(match[1]) >= 1 && Number(match[1]) <= pages, "PDF page outside source: " + id);
    }
  }
}
const chertokMetadata = JSON.stringify([chertokSource, ...chertokCards.map(card => ({
  id: card.id, sourceId: card.sourceId, sections: card.sections, paragraphIds: card.paragraphIds,
  quotes: card.quotes.map(quote => ({ attribution: quote.attribution, paragraphIds: quote.paragraphIds })),
  review: card.review,
}))]);
assert.ok(!/NASA|Rockets\s+and\s+People|chertok-rockets-and-people/iu.test(chertokMetadata),
  "English Chertok corpus remains in the active Wiki metadata");
const publicKnowledge = JSON.stringify([sources, cards]);
assert.ok(!/book-memory[\\/]|file:\/\/\/|\b[a-z]:(?:\\{1,2}|\/)[\w\u0400-\u04ff]/iu.test(publicKnowledge),
  "Private source path in public library or cards");
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
  if (card.locatorKind !== undefined) {
    assert.ok(["pdf-page", "paragraph"].includes(card.locatorKind), "Unknown source locator kind: " + card.id);
  }
  if (card.locatorNote !== undefined) nonempty(card.locatorNote, "Source locator note: " + card.id);
  if (card.locatorKind === "pdf-page") nonempty(card.locatorNote, "PDF pagination note: " + card.id);
  for (const quote of card.quotes) {
    nonempty(quote.text, "Quote: " + card.id);
    nonempty(quote.attribution, "Quote attribution: " + card.id);
    assert.ok(Array.isArray(quote.paragraphIds) && quote.paragraphIds.length, "Quote lacks locator: " + card.id);
    for (const id of quote.paragraphIds) assert.ok(card.paragraphIds.includes(id), "Quote outside card locator: " + card.id);
  }
}

console.log("Content passed: schema " + book.schemaVersion + "; " +
  mainChapters.filter((chapter) => chapter.status === "available").length + "/" + mainChapters.length +
  " available chapters; " + activeBlockCount + " current blocks; " + (blockCount - activeBlockCount) + " archive blocks; " + book.notes.length + " notes; " +
  authors.length + " authors; " + sources.length + " sources; " + cards.length + " cards.");
