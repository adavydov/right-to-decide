import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { siteConfig } from "../src/lib/site-config.ts";

const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const book = readJSON("src/data/book.json");
const authors = readJSON("src/data/authors.json").authors;
const sources = readJSON("src/data/library.json").sources;
const cards = readJSON("src/data/evidence-cards.json").cards;
const output = path.resolve("out");
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const publicOrigin = new URL(siteConfig.publicUrl).origin;
const available = book.chapters.filter((chapter) => chapter.id !== "source-contents" && chapter.status === "available");
const routes = ["/", "/contents/", "/authors/", "/read/", "/library/", "/wiki/",
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
  const info = { raw, text, ids, attributes };
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
  for (const block of chapter.blocks) {
    if (block.type === "image") {
      assert.ok(info.attributes.some(({ tag, attrs }) => tag === "img" && attrs.get("src")?.split("?")[0] === base + block.src), "Missing chapter figure: " + block.src);
    }
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
