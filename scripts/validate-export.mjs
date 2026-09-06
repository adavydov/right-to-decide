import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { siteConfig } from "../src/lib/site-config.ts";

const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const book = readJSON("src/data/book.json");
const archive = readJSON("src/data/previous-edition.json");
const isV7 = ["7.0", "7.1"].includes(book.editionVersion);
const archiveChapters = archive.chapters.filter(c => c.id !== "source-contents" && c.status === "available");
const authors = readJSON("src/data/authors.json").authors;
const sources = readJSON("src/data/library.json").sources;
const cards = readJSON("src/data/evidence-cards.json").cards;
const output = path.resolve("out");
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const publicOrigin = new URL(siteConfig.publicUrl).origin;
const available = book.chapters.filter((chapter) => chapter.id !== "source-contents" && chapter.status === "available");
const routes = ["/", "/contents/", "/authors/", "/read/", "/library/", "/wiki/", "/archive/", "/manifesto/",
  ...archiveChapters.map(c => "/archive/" + c.id + "/"),
  ...available.map((chapter) => "/read/" + chapter.id + "/"),
  ...cards.map((card) => "/wiki/" + card.id + "/")];
const plannedRoutes = new Set(book.chapters.filter((chapter) => chapter.status === "planned")
  .map((chapter) => "/read/" + chapter.id + "/"));
const htmlCache = new Map();

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
    if (entity[0] === "#") return String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase() === "x" ? 2 : 1), entity[1].toLowerCase() === "x" ? 16 : 10));
    return { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " }[entity.toLowerCase()];
  });
}
function normalized(value) {
  return decodeEntities(value).replace(/\s+/gu, " ").trim();
}
function mergeRuns(runs) {
  const merged = [];
  for (const run of runs) {
    if (!run.text) continue;
    const previous = merged.at(-1);
    if (previous && ["strong", "emphasis", "code", "href"].every((key) => previous[key] === run[key])) previous.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
}
function readerRuns(markup) {
  const result = new Map();
  const stack = [];
  let active;
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  for (const token of markup.matchAll(/<[^>]*>|[^<]+/g)) {
    const closing = /^<\/([\w-]+)/.exec(token[0]);
    const opening = /^<([\w-]+)/.exec(token[0]);
    if (closing) {
      const index = stack.findLastIndex((entry) => entry.tag === closing[1].toLowerCase());
      if (index >= 0) stack.length = index;
      if (active && stack.length < active.depth) active = undefined;
    } else if (opening) {
      const tag = opening[1].toLowerCase();
      const attrs = new Map([...token[0].matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
        .map((match) => [match[1].toLowerCase(), decodeEntities(match[2] ?? match[3])]));
      if (!voidTags.has(tag)) {
        stack.push({ tag, attrs });
        if (attrs.has("data-reader-block") && attrs.has("id") && !active) {
          active = { depth: stack.length, runs: [] };
          result.set(attrs.get("id"), active.runs);
        }
      }
    } else if (active && !token[0].startsWith("<") && !stack.some((entry) => entry.attrs.get("class")?.split(/\s+/).includes("list-marker"))) {
      const href = stack.findLast((entry) => entry.tag === "a")?.attrs.get("href");
      active.runs.push({ text: decodeEntities(token[0]),
        strong: stack.some((entry) => entry.tag === "strong"),
        emphasis: stack.some((entry) => entry.tag === "em"),
        code: stack.some((entry) => entry.tag === "code"), href: href || null });
    }
  }
  return new Map([...result].map(([id, runs]) => [id, mergeRuns(runs)]));
}
function routeFile(route) {
  return path.join(output, ...route.split("/").filter(Boolean), "index.html");
}
function htmlInfo(file) {
  if (htmlCache.has(file)) return htmlCache.get(file);
  const raw = fs.readFileSync(file, "utf8");
  const markup = raw.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, "$1</script>")
    .replace(/<!--[\s\S]*?-->/g, "");
  const ids = new Set();
  const attributes = [];
  for (const tag of markup.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const attrs = new Map();
    for (const match of tag[2].matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs.set(match[1].toLowerCase(), decodeEntities(match[2] ?? match[3]));
    }
    if (attrs.has("id")) {
      assert.ok(!ids.has(attrs.get("id")), "Duplicate HTML id " + attrs.get("id") + " in " + file);
      ids.add(attrs.get("id"));
    }
    attributes.push({ tag: tag[1].toLowerCase(), attrs });
  }
  const text = normalized(markup.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " "));
  const info = { raw, text, ids, attributes, readerRuns: readerRuns(markup) };
  htmlCache.set(file, info);
  return info;
}
function urlForFile(file) {
  let relative = path.relative(output, file).split(path.sep).join("/");
  relative = relative.replace(/(?:^|\/)index\.html$/, "/").replace(/^\/+/, "");
  return new URL(base + "/" + relative, publicOrigin);
}
function internalTarget(value, documentURL, label) {
  assert.ok(!/[\u0000-\u001f\\]/u.test(value), "Unsafe URL in " + label);
  if (value.startsWith("data:")) {
    assert.match(value, /^data:image\/(?:png|gif|jpe?g|webp|avif|svg\+xml)[;,]/i, "Unexpected data URL in " + label);
    return null;
  }
  assert.ok(!value.startsWith("//"), "Protocol-relative URL in " + label);
  let url;
  assert.doesNotThrow(() => { url = new URL(value, documentURL); }, "Malformed URL in " + label);
  assert.ok(["http:", "https:", "mailto:"].includes(url.protocol), "Unsafe URL protocol in " + label);
  if (url.protocol === "mailto:") return null;
  assert.ok(!url.username && !url.password, "Credentials in exported URL: " + label);
  if (url.origin !== publicOrigin) return null;
  const isWithinBase = !base || url.pathname === base || url.pathname.startsWith(base + "/");
  if (!isWithinBase) {
    assert.ok(/^[a-z][a-z\d+.-]*:/i.test(value), "Local URL omits base path: " + value + " in " + label);
    return null;
  }
  let local;
  assert.doesNotThrow(() => { local = decodeURIComponent(url.pathname.slice(base.length) || "/"); }, "Malformed path in " + label);
  assert.ok(!local.includes("\\") && !local.split("/").includes(".."), "Unsafe export path in " + label);
  assert.ok(!plannedRoutes.has(local.replace(/\/?$/, "/")), "Link to a planned chapter: " + value + " in " + label);
  let file = path.resolve(output, "." + local);
  assert.ok(file === output || file.startsWith(output + path.sep), "Export path escapes out/: " + label);
  assert.ok(fs.existsSync(file), "Broken resource " + value + " in " + label);
  if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), "Missing exported file " + value + " in " + label);
  if (url.hash && /\.html$/i.test(file)) {
    let anchor;
    assert.doesNotThrow(() => { anchor = decodeURIComponent(url.hash.slice(1)); }, "Malformed anchor in " + label);
    if (anchor) assert.ok(htmlInfo(file).ids.has(anchor), "Broken anchor " + value + " in " + label);
  }
  return file;
}
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

assert.ok(fs.existsSync(output), "Build the static export before checking it");
for (const route of routes) {
  const file = routeFile(route);
  assert.ok(fs.existsSync(file), "Missing route " + route);
  const info = htmlInfo(file);
  assert.ok(info.ids.has("main-content"), "No main content in " + route);
  assert.ok(info.text.includes(book.title), "No book identity in " + route);
}
const files = walk(output);
for (const file of files) {
  const relative = path.relative(output, file).split(path.sep).join("/");
  assert.ok(!/(?:^|\/)(?:book-memory|\.env(?:\.[^/]*)?)(?:\/|$)/i.test(relative), "Private file or directory in export: " + relative);
  assert.ok(!/\.fb2(?:\.zip)?$/i.test(relative), "Full source FB2 in export: " + relative);
  if (/\.(?:html|css|js|mjs|json|txt|xml|map|md)$/i.test(file)) {
    const text = fs.readFileSync(file, "utf8");
    assert.ok(!/\b[a-z]:\\{1,2}[\w\u0400-\u04ff]/iu.test(text) && !/file:\/\/\/[a-z]:\//i.test(text), "Local Windows path in " + relative);
    assert.ok(!/book-memory[\\/]/i.test(text), "Private corpus path in " + relative);
    assert.ok(!/(?:^|[\s"'<>/\\])\.env(?:\.[\w.-]+)?(?=$|[\s"'<>/\\?#])/im.test(text), "Private environment filename in " + relative);
  }
  if (/\.html$/i.test(file)) {
    const info = htmlInfo(file);
    const documentURL = urlForFile(file);
    for (const { tag, attrs } of info.attributes) {
      for (const key of ["href", "src", "poster"]) {
        if (!attrs.has(key)) continue;
        const value = attrs.get(key);
        if (value.startsWith("data:")) assert.ok(key !== "href", "Data navigation in " + relative);
        internalTarget(value, documentURL, relative + " " + tag + "[" + key + "]");
      }
      for (const key of ["srcset", "imagesrcset"]) {
        if (!attrs.has(key) || attrs.get(key).startsWith("data:")) continue;
        for (const candidate of attrs.get(key).split(",")) {
          const value = candidate.trim().split(/\s+/)[0];
          if (value) internalTarget(value, documentURL, relative + " " + key);
        }
      }
    }
  } else if (/\.css$/i.test(file)) {
    const css = fs.readFileSync(file, "utf8");
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      internalTarget(match[1].trim(), urlForFile(file), relative + " CSS url");
    }
  }
}

const homepage = htmlInfo(routeFile("/"));
const contentsPage = htmlInfo(routeFile("/contents/"));
for (const part of book.parts) {
  assert.ok(contentsPage.text.includes(normalized(part.title)), "Missing contents part: " + part.id);
  for (const paragraph of part.description || []) assert.ok(contentsPage.text.includes(normalized(paragraph)), "Lost author part description: " + part.id);
}
for (const chapter of book.chapters.filter(c => c.kind === "chapter")) {
  assert.ok(contentsPage.text.includes(normalized(chapter.title.replace(/^Глава \d+\.\s*/u, ""))), "Missing chapter heading: " + chapter.id);
  assert.ok(contentsPage.text.includes(normalized(chapter.summary)), "Missing constitutional chapter function: " + chapter.id);
}
assert.ok(contentsPage.text.includes("Следующий вопрос — не наш"), "Missing separately planned epilogue");
const legacyPreface = htmlInfo(routeFile("/read/preface/"));
assert.ok(legacyPreface.raw.includes("/read/prologue/"), "Legacy preface must lead to the current prologue");
assert.ok(!legacyPreface.raw.includes("preface-v8-p"), "Legacy address still contains the replaced preface");
for (const chapter of archiveChapters) {
  const info = htmlInfo(routeFile("/archive/" + chapter.id + "/"));
  for (const block of chapter.blocks) {
    assert.ok(info.ids.has(block.id), "Lost archive block: " + block.id);
    if (block.type === "paragraph") assert.ok(info.text.includes(normalized(block.text)), "Lost archive paragraph: " + block.id);
    if (block.type === "table") for (const row of block.rows) for (const cell of row) assert.ok(info.text.includes(normalized(cell)), "Lost archive table cell: " + block.id);
  }
}
assert.ok(homepage.text.includes(normalized(siteConfig.subtitle)), "Missing exact site subtitle on homepage");
const coverFile = internalTarget(base + siteConfig.coverPath, urlForFile(routeFile("/")), "Book cover");
assert.ok(coverFile, "Missing local cover");
assert.ok(homepage.attributes.some(({ tag, attrs }) => tag === "img" && attrs.get("src")?.split("?")[0] === base + siteConfig.coverPath), "Homepage does not show the current cover");
const authorsPage = htmlInfo(routeFile("/authors/"));
for (const author of authors) {
  assert.ok(authorsPage.text.includes(normalized(author.name)), "Missing author name: " + author.id);
  assert.ok(authorsPage.text.includes(normalized(author.role)), "Missing author role: " + author.id);
  assert.ok(authorsPage.text.includes(normalized(author.bio)), "Missing current biography: " + author.id);
}

for (const chapter of available) {
  const info = htmlInfo(routeFile("/read/" + chapter.id + "/"));
  for (const block of [...chapter.blocks, ...book.notes.filter(note => note.chapterId === chapter.id).flatMap(note => note.blocks)]) {
    assert.ok(info.ids.has(block.id), "Lost current block: " + block.id);
    if (block.type === "paragraph" || block.type === "heading") {
      if (/^manuscript-v[67]-/.test(block.id)) {
        const expectedRuns = mergeRuns((block.runs || [{ text: block.text }]).map((run) => ({
          text: run.text, strong: Boolean(run.strong), emphasis: Boolean(run.emphasis), code: Boolean(run.code),
          href: run.noteId ? "#" + run.noteId : run.href || null,
        })));
        assert.deepEqual(info.readerRuns.get(block.id), expectedRuns, "Reader text, formatting or source target drifted: " + block.id);
      } else {
        assert.ok(info.text.includes(normalized(block.text)), "Lost current author text: " + block.id);
      }
    }
    if (block.type === "table") {
      const expectedRuns = mergeRuns(block.rows.flatMap((row, ri) => row.flatMap((cell, ci) =>
        (block.cellRuns?.[ri]?.[ci] || [{ text: cell }]).map(run => ({
          text: run.text, strong: Boolean(run.strong), emphasis: Boolean(run.emphasis), code: Boolean(run.code),
          href: run.noteId ? "#" + run.noteId : run.href || null,
        }))
      )));
      assert.deepEqual(info.readerRuns.get(block.id), expectedRuns, "Reader table text, order or formatting drifted: " + block.id);
    }
    if (block.type === "image") {
      assert.ok(info.attributes.some(({ tag, attrs }) => tag === "img" && attrs.get("src")?.split("?")[0] === base + block.src), "Missing chapter figure: " + block.src);
    }
  }
  if (chapter.download) {
    const href = base + chapter.download.docx;
    assert.ok(info.attributes.some(({ tag, attrs }) => tag === "a" && attrs.get("href") === href), "Missing reader DOCX link: " + chapter.id);
    assert.ok(contentsPage.attributes.some(({ tag, attrs }) => tag === "a" && attrs.get("href") === href), "Missing contents DOCX link: " + chapter.id);
    const exported = internalTarget(href, urlForFile(routeFile("/contents/")), chapter.id + " DOCX");
    assert.deepEqual(fs.readFileSync(exported), fs.readFileSync("public" + chapter.download.docx), "Exported DOCX differs: " + chapter.id);
  }
  const notes = book.notes.filter((note) => note.chapterId === chapter.id);
  if (notes.length) {
    assert.ok(info.text.includes(normalized(chapter.notesHeading || "Примечания")), "Lost source notes heading: " + chapter.id);
    for (const note of notes) assert.ok(info.ids.has(note.id), "Missing note definition: " + note.id);
    for (const block of [...chapter.blocks, ...notes.flatMap((note) => note.blocks)]) {
      block.runs?.forEach((run, index) => {
        if (!run.noteId) return;
        const refId = block.id + "-ref-" + index;
        assert.ok(info.ids.has(refId), "Missing note reference: " + refId);
        assert.ok(info.attributes.some(({ tag, attrs }) => tag === "a" && attrs.get("id") === refId && attrs.get("href") === "#" + run.noteId), "Wrong note destination: " + refId);
        assert.ok(info.attributes.some(({ tag, attrs }) => tag === "a" && attrs.get("href") === "#" + refId), "Missing note backlink: " + refId);
      });
    }
  }
}

if (isV7) {
  const texts = available.filter(chapter => chapter.contentKind === "manuscript");
  assert.equal(texts.length, 20, "All twenty literary sections must be exported");
  assert.equal(texts.filter(chapter => chapter.download?.docx).length, 20, "All twenty section downloads must be exported");
  const readPage = htmlInfo(routeFile("/read/"));
  assert.ok(readPage.text.includes("редакция " + book.editionVersion), "The reader must identify the selected edition");
  for (const format of ["docx", "pdf"]) {
    const download = book.downloads[format];
    const href = base + download.path;
    assert.ok(readPage.attributes.some(({ tag, attrs }) => tag === "a" && attrs.get("href") === href && attrs.has("download")), "Missing whole-book download link: " + format);
    const file = internalTarget(href, urlForFile(routeFile("/read/")), "Whole-book " + format);
    assert.deepEqual(fs.readFileSync(file), fs.readFileSync("public" + download.path), "Exported whole-book download differs: " + format);
  }
}

const teamSource = readJSON("src/data/editorial-team.json");
assert.deepEqual(teamSource, readJSON("docs/editorial/editorial-team-v4.0.json"), "The public team must match the accepted editorial contract");
const teamDocument = readJSON(path.join(output, "editorial-team.json"));
assert.equal(teamDocument.schemaVersion, 1);
assert.equal(teamDocument.version, "4.0");
assert.equal(teamDocument.scope, "editorial-role-catalog");
assert.deepEqual(teamDocument.humanAuthors.map(({ id, name, role }) => ({ id, name, role })),
  authors.map(({ id, name, role }) => ({ id, name, role })), "Machine-readable human credits drifted");
assert.deepEqual(teamDocument.humanDirection, teamSource.humanDirection);
assert.equal(teamDocument.intro, teamSource.intro);
assert.equal(teamDocument.description, teamSource.roleNote);
assert.equal(teamDocument.conductor.type, "ai-agent-role");
assert.deepEqual(teamDocument.conductor.accountableTo, authors.map((author) => author.id));
assert.equal(teamDocument.conductor.description, teamSource.conductor.description);
assert.deepEqual(teamDocument.governance.steps, teamSource.principle.steps);
assert.equal(teamDocument.governance.description, teamSource.principle.description);
assert.equal(teamDocument.governance.commonVersionEditor, "integrator");
assert.deepEqual(teamDocument.groups.map(({ id, title, description, roles }) => ({
  id, title, description, roles: roles.map(({ id, name, description }) => ({ id, name, description })),
})), teamSource.groups, "Machine-readable agent roles drifted");
const teamRoles = teamDocument.groups.flatMap((group) => group.roles);
const layerRoles = teamDocument.groups.find((group) => group.id === "nine-layers")?.roles;
assert.equal(layerRoles?.length, 9, "The constitution needs nine distinct layer curators");
assert.deepEqual(layerRoles.map((role) => role.name.slice(0, 3)), Array.from({ length: 9 }, (_, index) => "С0" + (index + 1)));
assert.equal(teamDocument.practicalProject.assignments, "not-confirmed", "Do not imply that the pilot roles have been assigned");
assert.deepEqual(teamDocument.practicalProject.roles.map(({ id, name, description }) => ({ id, name, description })), teamSource.practicalProject.roles);
assert.ok(teamDocument.practicalProject.roles.every((role) => role.type === "required-human-function" && role.assignedTo === null), "Human pilot accountability cannot be assigned to editorial AI roles");
assert.equal(new Set([teamDocument.conductor.id, ...teamRoles.map((role) => role.id)]).size,
  teamRoles.length + 1, "Duplicate editorial role ID");
assert.ok(teamRoles.some((role) => role.id === teamDocument.governance.commonVersionEditor));
assert.ok(teamRoles.every((role) => role.type === "ai-agent-role" && role.coordinatedBy === teamDocument.conductor.id));
for (const info of [homepage, authorsPage]) {
  assert.ok(info.text.includes(normalized(teamSource.practicalProject.status)), "Missing visible pilot assignment status");
  assert.ok(info.text.includes(normalized(teamSource.practicalProject.description)), "Missing distinction between editorial AI and human responsibility");
  assert.ok(info.ids.has("literary-team"), "Missing visible editorial team");
  for (const author of authors) {
    assert.ok(info.raw.indexOf('id="author-' + author.id + '"') < info.raw.indexOf('id="literary-team"'),
      "Literary team must follow every human author");
  }
  for (const role of [teamDocument.conductor, ...teamRoles]) {
    assert.ok(info.text.includes(normalized(role.name)), "Missing visible role: " + role.id);
    assert.ok(info.text.includes(normalized(role.description)), "Missing visible responsibility: " + role.id);
  }
  assert.ok(info.attributes.some(({ tag, attrs }) => tag === "a" && attrs.get("href") === base + "/editorial-team.json"),
    "No visible machine-readable credits link");
  assert.ok(info.attributes.some(({ tag, attrs }) => tag === "link" && attrs.get("rel") === "alternate" &&
    attrs.get("type") === "application/json" && attrs.get("href") === base + "/editorial-team.json"),
    "No machine-readable credits discovery link");
  const linkedData = [...info.raw.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
  const credit = linkedData.find((item) => item["@type"] === "Book");
  assert.ok(credit, "Missing Book structured data");
  assert.deepEqual(credit.author.map((author) => author.name), authors.map((author) => author.name));
  assert.ok(credit.author.every((author) => author["@type"] === "Person"));
  assert.equal(credit.contributor["@id"], teamDocument.humanReadableUrl);
  assert.equal(credit.contributor.subjectOf.url, teamDocument.machineReadableUrl);
}
console.log("Editorial credits passed: shared human/AI roster, hierarchy, visible order and structured data.");

const libraryPage = htmlInfo(routeFile("/library/"));
for (const source of sources) assert.ok(libraryPage.ids.has(source.id), "Missing library source anchor: " + source.id);
for (const card of cards) {
  const info = htmlInfo(routeFile("/wiki/" + card.id + "/"));
  assert.ok(info.text.includes(normalized(card.title)), "Missing wiki title: " + card.id);
  for (const quote of card.quotes) {
    assert.ok(info.text.includes(normalized(quote.text)), "Missing wiki quote: " + card.id);
    assert.ok(info.text.includes(normalized(quote.attribution)), "Missing quote attribution: " + card.id);
  }
}
console.log("Export passed: " + routes.length + " publication routes; " + files.length +
  " files; local assets and anchors; current cover/subtitle and biographies; library/wiki; notes and privacy boundaries.");

await import("./validate-manifesto-export.mjs");
