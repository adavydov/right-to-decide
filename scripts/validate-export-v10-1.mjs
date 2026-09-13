// Validate the complete currently installed static release, without loading retired corpora.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { siteConfig } from "../src/lib/site-config.ts";
import { isLibraryAlias, visibleLibrarySources, libraryAliasTargets } from "../shared/library-aliases.mjs";
import { sectionIds, webId } from "./validate-content-v10-1.mjs";

const readJSON = file => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const sha = raw => createHash("sha256").update(raw).digest("hex");
const book = readJSON("src/data/book.json");
const release = readJSON("manuscript/v10-1/release-manifest.json");
const library = readJSON("src/data/library-source-cards.json");
const essence = readJSON("src/data/essence-v10-1.json");
const authors = readJSON("src/data/authors.json").authors;
const output = path.resolve("out");
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const publicOrigin = new URL(siteConfig.publicUrl).origin;
const available = book.chapters;
const routes = ["/", "/contents/", "/authors/", "/read/", "/library/", "/manifesto/", "/research/v10/", "/essence/",
  ...available.map(c => "/read/" + c.id + "/"),
  ...library.sources.map(s => "/library/" + s.id + "/")];
const plannedRoutes = new Set();
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
  assert.ok(!/^\/(?:archive|editions|wiki)(?:\/|$)/.test(local), "Link to a retired edition in " + label);
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
assert.equal(book.editionVersion, "10.1");
assert.equal(book.statistics.sections, 28);
assert.equal(book.statistics.chapters, 26);
assert.deepEqual(available.map(c => c.id), sectionIds.map(webId));
assert.ok(available.every(c => c.status === "available" && c.version === "10.1"));
assert.equal(sha(fs.readFileSync("src/data/book.json")), release.bookSha256);
assert.equal(book.releaseId, release.releaseId);
for (const route of routes) {
  const file = routeFile(route);
  assert.ok(fs.existsSync(file), "Missing route " + route);
  const info = htmlInfo(file);
  assert.ok(info.ids.has("main-content"), "No main content in " + route);
  assert.ok(info.text.includes(book.title), "No book identity in " + route);
}
// User-provided source PDFs remain private even if renamed before export.
const privateChertokFiles = new Map([
  [3940124, "220e3551350337aa5f28f9458dfbdceec30f9a73ea5abe3f2af310cd3ee244aa"],
  [3777066, "988d36286df44e11c5d227868ba36bee712db4394922c7cd419910b567f52aad"],
  [10808631, "5b8fa12d319aab9bccb07805ffb0ae0290786152b0d8723fa7b6dcec86aefe4b"],
  [5883741, "4c48b355128e39cdb06e5ca0809b09eaf2d98fd11e8b9542c5407d6f19f08325"],
]);
const files = walk(output);
for (const file of files) {
  const relative = path.relative(output, file).split(path.sep).join("/");
  assert.ok(!/(?:^|\/)(?:book-memory|\.env(?:\.[^/]*)?)(?:\/|$)/i.test(relative), "Private file or directory in export: " + relative);
  assert.ok(!/\.(?:fb2|epub|azw3|mobi)(?:\.zip)?$/i.test(relative), "Full source e-book in export: " + relative);
  assert.ok(!/(?:chertok|черток|ракеты.{0,10}люди).*\.(?:pdf|epub|zip)$/iu.test(relative),
    "Chertok source file in export: " + relative);
  const privateHash = privateChertokFiles.get(fs.statSync(file).size);
  if (privateHash) {
    assert.notEqual(createHash("sha256").update(fs.readFileSync(file)).digest("hex"), privateHash,
      "Private Chertok PDF in export: " + relative);
  }
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
const readPage = htmlInfo(routeFile("/read/"));
const authorsPage = htmlInfo(routeFile("/authors/"));
const hasLink = (info, href) => info.attributes.some(({tag, attrs}) => tag === "a" && attrs.get("href") === href);
const textPresent = (info, text, label) => assert.ok(info.text.includes(normalized(text)), "Lost visible text: " + label);
function elementInfo(info, id) {
  const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const opening = new RegExp('<([a-z][\\w:-]*)\\b[^>]*\\bid="' + safeId + '"[^>]*>', 'i').exec(info.raw);
  assert.ok(opening, 'Missing text container: ' + id);
  const boundary = new RegExp('</?' + opening[1] + '\\b[^>]*>', 'gi');
  boundary.lastIndex = opening.index + opening[0].length;
  let depth = 1;
  for (let token; (token = boundary.exec(info.raw));) {
    depth += token[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      const markup = info.raw.slice(opening.index, boundary.lastIndex)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');
      return {text: normalized(markup.replace(/<[^>]*>/g, ' '))};
    }
  }
  assert.fail('Unclosed text container: ' + id);
}
for (const part of book.parts) textPresent(contentsPage, part.title, part.id);
for (const chapter of available) {
  textPresent(contentsPage, chapter.title.replace(/^Глава [\dАБab]+\.\s*/u, ""), chapter.id);
  assert.ok(hasLink(contentsPage, base + "/read/" + chapter.id + "/"), "Missing contents link " + chapter.id);
}
textPresent(homepage, book.subtitle, "home subtitle");
assert.equal(siteConfig.subtitle, book.subtitle);
const coverFile = internalTarget(base + siteConfig.coverPath, urlForFile(routeFile("/")), "Current book cover");
assert.equal(sha(fs.readFileSync(coverFile)), release.checks.coverSha256);
const hero = base + "/images/right-to-decide-hero-v10-1.png";
assert.ok(homepage.attributes.some(({tag,attrs}) => tag === "img" && attrs.get("src")?.split("?")[0] === hero), "Homepage does not show current generated hero");
assert.ok(hasLink(homepage, base + "/essence/"), "Homepage needs the Essence entry");
for (const author of authors) for (const key of ["name", "role", "bio"]) textPresent(authorsPage, author[key], author.id + " " + key);
const preface = htmlInfo(routeFile("/read/preface/"));
assert.ok(preface.raw.includes("/read/prologue/"), "Compatibility address must lead to the current prologue");
assert.ok(!preface.raw.includes("preface-v8-p"), "Replaced preface remains at compatibility URL");
for (const chapter of available) {
  const info = htmlInfo(routeFile("/read/" + chapter.id + "/"));
  for (const block of [...chapter.blocks, ...book.notes.filter(note => note.chapterId === chapter.id).flatMap(note => note.blocks)]) {
    assert.ok(info.ids.has(block.id), "Lost current block: " + block.id);
    if (block.type === "paragraph" || block.type === "heading") {
        const expectedRuns = mergeRuns((block.runs || [{ text: block.text }]).map((run) => ({
          text: run.text, strong: Boolean(run.strong), emphasis: Boolean(run.emphasis), code: Boolean(run.code),
          href: run.noteId ? "#" + run.noteId : run.href || null,
        })));
        assert.deepEqual(info.readerRuns.get(block.id), expectedRuns, "Reader text, formatting or source target drifted: " + block.id);
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
      if (block.type === "table") block.cellRuns?.forEach((row, ri) => row.forEach((cell, ci) => cell.forEach((run, index) => {
        if (!run.noteId) return;
        const refId = `${block.id}-r${ri}-c${ci}-ref-${index}`;
        assert.ok(info.ids.has(refId), "Missing table note reference: " + refId);
        assert.ok(info.attributes.some(({tag, attrs}) => tag === "a" && attrs.get("id") === refId && attrs.get("href") === "#" + run.noteId));
        assert.ok(info.attributes.some(({tag, attrs}) => tag === "a" && attrs.get("href") === "#" + refId), "Missing table note backlink");
      })));
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

// Match every release download to its exact accepted bytes in both public/ and out/.
const acceptedPublicFiles = new Set();
for (const item of release.artifacts.filter(item => item.path.startsWith('public/'))) {
  const relative = item.path.slice('public/'.length);
  acceptedPublicFiles.add(relative);
  const target = path.join(output, relative);
  assert.ok(fs.existsSync(target), 'Missing accepted public artifact: ' + relative);
  const raw = fs.readFileSync(target);
  assert.equal(sha(raw), item.sha256, 'Export artifact hash differs: ' + relative);
  assert.equal(raw.length, item.bytes, 'Export artifact size differs: ' + relative);
  assert.deepEqual(raw, fs.readFileSync(item.path), 'public/ and out/ differ: ' + relative);
}
for (const [format, download] of Object.entries(book.downloads)) {
  const href = base + download.path;
  assert.ok(readPage.attributes.some(({tag,attrs}) => tag === 'a' && attrs.get('href') === href && attrs.has('download')), 'Missing whole-book download: ' + format);
}
assert.ok(available.every(c => c.download?.docx), 'All 28 sections need a DOCX');
for (const chapter of available) {
  const info = htmlInfo(routeFile('/read/' + chapter.id + '/'));
  const blocks = [...chapter.blocks, ...book.notes.filter(n => n.chapterId === chapter.id).flatMap(n => n.blocks)];
  assert.deepEqual([...info.readerRuns.keys()], blocks.map(b => b.id), 'Reader block order or extra prose differs: ' + chapter.id);
}

const team = readJSON('src/data/editorial-team-v10.json');
const teamDocument = readJSON(path.join(output, 'editorial-team.json'));
assert.equal(team.status, 'accepted-public-package');
assert.equal(teamDocument.version, '10.1');
assert.equal(teamDocument.roles.length, 13);
assert.deepEqual(teamDocument.roles.map(({id,name,description,libraryThemes}) => ({id,name,description,libraryThemes})), team.roles);
assert.deepEqual(teamDocument.workflow, team.workflow);
assert.ok(teamDocument.roles.every(r => r.type === 'ai-agent-role'));
assert.deepEqual(teamDocument.humanAuthors.map(({id,name,role}) => ({id,name,role})), authors.map(({id,name,role}) => ({id,name,role})));
for (const role of team.roles) for (const key of ['name','description']) textPresent(authorsPage, role[key], role.id + ' ' + key);
textPresent(authorsPage, team.roleNote, 'Editorial role scope');
for (const info of [homepage, authorsPage]) {
  const credit = [...info.raw.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1])).find(item => item['@type'] === 'Book');
  assert.ok(credit, 'Missing Book structured data');
  assert.deepEqual(credit.author.map(author => author.name), authors.map(author => author.name));
  assert.equal(credit.creditText, team.intro);
  assert.equal(credit.contributor['@id'], teamDocument.humanReadableUrl);
  assert.equal(credit.contributor.subjectOf.url, teamDocument.machineReadableUrl);
}

const research = readJSON('src/data/research-v10.json');
const manifesto = readJSON('src/data/manifesto-v10.json');
assert.deepEqual(research.models.map(model => model.id), ['M01','M02','M03','M04','M05']);
for (const [route, sections] of [['/research/v10/', [research, ...research.models]], ['/manifesto/', [manifesto]]]) {
  const info = htmlInfo(routeFile(route));
  const ordered = [];
  for (const section of sections) {
    assert.equal(section === research || section === manifesto ? section.status : research.status, 'accepted-public-package');
    textPresent(info, section.title, section.id || route);
    for (const block of [...section.blocks, ...section.notes.flatMap(note => note.blocks)]) {
      ordered.push(block.id);
      assert.ok(info.ids.has(block.id), 'Missing public source block: ' + block.id);
      const runs = block.type === 'table' ? block.rows.flatMap((row,ri) => row.flatMap((cell,ci) => block.cellRuns?.[ri]?.[ci] || [{text:cell}])) : block.runs || [{text:block.text}];
      const expected = mergeRuns(runs.map(run => ({text:run.text,strong:Boolean(run.strong),emphasis:Boolean(run.emphasis),code:Boolean(run.code),href:run.noteId ? '#' + run.noteId : run.href || null})));
      assert.deepEqual(info.readerRuns.get(block.id), expected, 'Public source text or formatting differs: ' + block.id);
    }
    for (const item of section.downloads || []) assert.ok(hasLink(info, base + item.path), 'Missing model reproduction link: ' + item.name);
  }
  assert.deepEqual([...info.readerRuns.keys()], ordered, 'Public source order differs: ' + route);
}

// Only visible SSR markup is searched; React hydration data cannot satisfy these checks.
const essencePage = htmlInfo(routeFile('/essence/'));
assert.equal(essence.editionVersion, book.editionVersion);
assert.equal(essence.subtitle, book.subtitle);
assert.deepEqual(essence.steps.map(step => step.chapterId), sectionIds);
assert.deepEqual(essence.steps.map(step => step.id), Array.from({length:28},(_,i) => String(i+1).padStart(2,'0')));
textPresent(essencePage, essence.intro, 'Essence introduction');
textPresent(essencePage, essence.subtitle, 'Essence subtitle');
assert.deepEqual(essencePage.attributes.filter(({attrs}) => attrs.has('data-essence-step')).map(({attrs}) => attrs.get('data-essence-step')), essence.steps.map(step => step.id));
let paragraphCount = 0, forkCount = 0;
for (const step of essence.steps) {
  const stepInfo = elementInfo(essencePage, 'step-' + step.id);
  assert.ok(essencePage.ids.has('step-' + step.id));
  assert.ok(essencePage.ids.has('step-title-' + step.id));
  for (const text of [step.title,step.insight,...step.paragraphs]) textPresent(stepInfo, text, 'Essence step ' + step.id);
  let paragraphPosition = -1;
  for (const paragraph of step.paragraphs) {
    const nextPosition = stepInfo.text.indexOf(normalized(paragraph), paragraphPosition + 1);
    assert.ok(nextPosition > paragraphPosition, 'Essence paragraph order differs in step ' + step.id);
    paragraphPosition = nextPosition;
  }
  assert.ok(hasLink(essencePage, base + '/read/' + webId(step.chapterId) + '/'), 'Missing Essence chapter link: ' + step.id);
  paragraphCount += step.paragraphs.length;
  if (step.fork) {
    forkCount++;
    assert.ok(essencePage.ids.has('fork-' + step.id));
    let forkPosition = -1;
    for (const text of [step.fork.question,...step.fork.options.flatMap(option => [option.title,option.outcome])]) {
      const nextPosition = stepInfo.text.indexOf(normalized(text), forkPosition + 1);
      assert.ok(nextPosition > forkPosition, 'Essence fork text/order differs in step ' + step.id);
      forkPosition = nextPosition;
    }
  }
}

const libraryPage = htmlInfo(routeFile('/library/'));
const visibleSources = visibleLibrarySources(library.sources);
assert.equal(library.summary.records, library.sources.length);
assert.equal(library.summary.cards, library.sources.reduce((sum,source) => sum + source.cards.length,0));
const seenCards = new Set();
for (const source of library.sources) {
  const info = htmlInfo(routeFile('/library/' + source.id + '/'));
  assert.equal(source.cardCount, source.cards.length);
  const sourceCardIds = new Set(source.cards.map(card => card.id));
  assert.deepEqual(info.attributes.filter(({attrs}) => sourceCardIds.has(attrs.get('id'))).map(({attrs}) => attrs.get('id')), source.cards.map(card => card.id), 'Source card order differs: ' + source.id);
  for (const text of [source.title,source.annotation,source.edition,source.role,source.reading.scope,...source.authors]) textPresent(info,text,source.id);
  if (source.sourceNote) textPresent(info,source.sourceNote,source.id + ' source note');
  if (isLibraryAlias(source)) {
    assert.ok(!libraryPage.ids.has(source.id), 'Historical alias duplicates the main catalog: ' + source.id);
    const targets = libraryAliasTargets(source,library.sources);
    assert.ok(targets.length, 'Alias has no actual current cards: ' + source.id);
    for (const target of targets) assert.ok(hasLink(info,base + '/library/' + target.id + '/'), 'Missing alias card destination');
  } else {
    assert.ok(libraryPage.ids.has(source.id), 'Missing visible current source: ' + source.id);
    assert.ok(hasLink(libraryPage,base + '/library/' + source.id + '/'), 'Missing catalog source link');
  }
  for (const card of source.cards) {
    const cardInfo = elementInfo(info, card.id);
    assert.ok(!seenCards.has(card.id), 'Duplicate source card ID: ' + card.id);
    seenCards.add(card.id);
    assert.ok(info.ids.has(card.id), 'Card absent from SSR HTML: ' + card.id);
    assert.ok(hasLink(info,'#' + card.id), 'Missing card permalink: ' + card.id);
    for (const text of [card.title,card.idea,card.application,card.locator,...(card.mechanism ? [card.mechanism] : []),...(card.limits || [])]) textPresent(cardInfo,text,card.id);
    if (card.quote) for (const text of Object.values(card.quote)) textPresent(cardInfo,text,card.id + ' quotation');
  }
}

for (const relative of ['archive','editions','wiki','authors/v10-preview','library/v10-preview','manifesto/v10-preview','manifesto/constitution.md']) {
  assert.ok(!fs.existsSync(path.join(output,relative)), 'Retired public route survives: ' + relative);
}
for (const file of files) {
  const relative = path.relative(output,file).split(path.sep).join('/');
  if (relative.startsWith('book/')) assert.ok(acceptedPublicFiles.has(relative), 'Unaccepted or retired book download survives: ' + relative);
  if (relative.startsWith('editorial/editions/')) assert.ok(relative.startsWith('editorial/editions/' + book.releaseId + '/'), 'Old editorial corpus survives: ' + relative);
  // Historical IDs may be used to retain local notes, but full old book JSON must not enter browser bundles.
  if (/\.(?:js|html)$/i.test(relative)) {
    const text = fs.readFileSync(file,'utf8').replace(/\\"/g,'"');
    assert.ok(!/"editionVersion"\s*:\s*"(?:[4-9](?:\.\d+)?|10\.0)"\s*,\s*"version"/.test(text), 'Retired book projection in browser artifact: ' + relative);
  }
}
const sitemap = fs.readFileSync(path.join(output,'sitemap.xml'),'utf8');
for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  internalTarget(decodeEntities(match[1]), new URL(siteConfig.publicUrl + '/'), 'sitemap');
}
for (const route of ['/essence/',...available.map(c => '/read/' + c.id + '/'),...visibleSources.map(s => '/library/' + s.id + '/')]) {
  assert.ok(sitemap.includes(siteConfig.publicUrl + route), 'Current route missing from sitemap: ' + route);
}
console.log(`V10.1 EXPORT PASS: ${available.length} sections, ${routes.length} publication routes, ${essence.steps.length} Essence steps / ${paragraphCount} paragraphs / ${forkCount} forks, ${visibleSources.length} sources / ${seenCards.size} cards, ${files.length} files; exact prose, downloads, links, current-only routes and privacy.`);
