import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = (process.env.SITE_URL || "http://127.0.0.1:3217/right-to-decide").replace(/\/$/, "");
const target = new URL(base);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "This QA script is restricted to the local static export");
const source = fs.readFileSync("src/data/book.json");
const book = JSON.parse(source.toString("utf8").replace(/^\uFEFF/, ""));
assert.equal(book.editionVersion, "7.1");
const chapters = book.chapters.filter(chapter => chapter.status === "available" && chapter.contentKind === "manuscript");
assert.equal(chapters.length, 20);
assert.equal(book.notes.length, 22);
const directory = "docs/design-references/literary-v7.1";
fs.mkdirSync(directory, { recursive: true });
const report = {
  status: "running", at: new Date().toISOString(), base, edition: book.editionVersion,
  releaseId: book.releaseId, bookSha256: createHash("sha256").update(source).digest("hex"),
  browser: "Microsoft Edge, headless; fresh isolated context",
  pages: [], layouts: [], downloads: [], notes: [], screenshots: [], errors: [],
};
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => report.errors.push({ page: page.url(), error: error.message }));
page.on("request", request => {
  if (request.url().startsWith(base + "/") && !["GET", "HEAD"].includes(request.method())) {
    report.errors.push({ url: request.url(), method: request.method(), error: "Reading must not submit editorial data" });
  }
});
page.on("response", response => {
  if (response.status() >= 400 && response.url().startsWith(base + "/")) {
    report.errors.push({ url: response.url(), status: response.status() });
  }
});
const norm = value => value.replace(/\s+/gu, " ").trim();
const hash = raw => createHash("sha256").update(raw).digest("hex");
async function open(route) {
  const response = await page.goto(base + route, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200, "Page status: " + route);
  await page.evaluate(() => document.fonts.ready);
}
async function layout(name, width) {
  const value = await page.evaluate(() => ({
    viewport: innerWidth, width: document.documentElement.scrollWidth,
    heading: document.querySelector("h1")?.textContent,
  }));
  assert.ok(value.width <= width + 1, `${name}: horizontal overflow ${value.width} at ${width}px`);
  assert.ok(value.heading?.trim(), "Missing page heading: " + name);
  report.layouts.push({ name, ...value });
}
async function screenshot(name, locator) {
  const file = path.join(directory, name + ".png");
  if (locator) {
    const viewport = page.viewportSize();
    const box = await locator.boundingBox();
    await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, Math.ceil(box.height) + 300) });
    await locator.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await locator.screenshot({ path: file });
    await page.setViewportSize(viewport);
  }
  else await page.screenshot({ path: file, fullPage: false });
  report.screenshots.push(file.split(path.sep).join("/"));
}
async function checkDownload(download, id, format) {
  const publicPath = download.path || download.docx;
  const response = await context.request.get(target.origin + target.pathname + publicPath);
  assert.equal(response.status(), 200, "Download status: " + id);
  const raw = await response.body();
  assert.equal(raw.length, download.bytes, "Download size: " + id);
  assert.equal(hash(raw), download.sha256, "Download source checksum: " + id);
  assert.equal(raw.subarray(0, format === "pdf" ? 5 : 2).toString(), format === "pdf" ? "%PDF-" : "PK");
  report.downloads.push({ id, format, path: publicPath, bytes: raw.length, sha256: hash(raw) });
}
function chapterReferences(chapter) {
  return chapter.blocks.flatMap(block => (block.runs || []).flatMap((run, index) =>
    run.noteId ? [{ noteId: run.noteId, refId: `${block.id}-ref-${index}` }] : []));
}
try {
  await open("/read/");
  assert.ok(norm(await page.locator("main").textContent()).includes("редакция 7.1"));
  for (const format of ["docx", "pdf"]) {
    const download = book.downloads[format];
    const link = page.locator(`main a[href="${target.pathname}${download.path}"]`);
    assert.equal(await link.count(), 1, "Whole-book link: " + format);
    assert.notEqual(await link.getAttribute("download"), null);
    await checkDownload(download, "whole-book", format);
  }
  await open("/contents/");
  for (const chapter of chapters) {
    const link = page.locator(`main a[href="${target.pathname}${chapter.download.docx}"]`);
    assert.equal(await link.count(), 1, "Contents section download: " + chapter.id);
    await checkDownload(chapter.download, chapter.id, "docx");
  }
  assert.equal(await page.locator('main a[href$=".docx"]').count(), 20, "Exactly twenty individual section downloads");

  for (const chapter of chapters) {
    await open("/read/" + chapter.id + "/");
    const editorialEntry = page.locator("details").filter({ has: page.getByText("Личная заметка или черновик замечания", { exact: true }) });
    assert.equal(await editorialEntry.count(), 1, "Integrated optional editorial entry: " + chapter.id);
    assert.equal(await editorialEntry.getAttribute("open"), null, "Reading starts without opening the contribution form: " + chapter.id);
    const notes = book.notes.filter(note => note.chapterId === chapter.id);
    if (notes.length) {
      assert.equal(await page.locator(".reading-notes ol").evaluate(element => getComputedStyle(element).listStyleType), "decimal", "Visible note numbering: " + chapter.id);
    }
    const blocks = [...chapter.blocks, ...notes.flatMap(note => note.blocks)];
    const actual = await page.evaluate(ids => Object.fromEntries(ids.map(id => {
      const element = document.getElementById(id);
      if (!element) return [id, null];
      const copy = element.cloneNode(true);
      copy.querySelectorAll(".list-marker").forEach(marker => marker.remove());
      return [id, copy.textContent];
    })), blocks.map(block => block.id));
    for (const block of blocks) {
      if (block.type === "image") continue;
      const expected = block.type === "table" ? block.rows.flat().join("") : block.text;
      assert.equal(actual[block.id], expected, "Exact rendered body/note text: " + block.id);
    }
    assert.equal(await page.locator(`a.reading-download[href="${target.pathname}${chapter.download.docx}"]`).count(), 1, "Section download link: " + chapter.id);
    const references = chapterReferences(chapter);
    for (const reference of references) {
      const forward = page.locator(`[id="${reference.refId}"]`);
      const note = page.locator(`[id="${reference.noteId}"]`);
      const backward = note.locator(`a[href="#${reference.refId}"]`);
      assert.equal(await forward.getAttribute("href"), "#" + reference.noteId);
      assert.equal(await note.count(), 1);
      assert.equal(await backward.count(), 1);
      await forward.click();
      await page.waitForFunction(id => location.hash === "#" + id, reference.noteId);
      await backward.click();
      await page.waitForFunction(id => location.hash === "#" + id, reference.refId);
      report.notes.push({ chapter: chapter.id, ...reference, forward: "passed", backward: "passed" });
    }
    report.pages.push({ id: chapter.id, blocks: blocks.length, notes: notes.length, references: references.length, exactText: "passed" });
    console.log("Text and notes passed: " + chapter.id);
  }
  assert.equal(new Set(report.notes.map(note => note.noteId)).size, 22, "All twenty-two notes navigated");
  const repeated = report.notes.filter(note => report.notes.filter(other => other.noteId === note.noteId).length > 1);
  assert.ok(repeated.length >= 2, "A repeated note must be navigated from both references and back");
  report.repeatedNotes = repeated;

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await open("/read/");
    await layout("read", width);
    await screenshot("read-" + width);
    await open("/contents/");
    await layout("contents", width);
    for (const chapter of chapters) {
      await open("/read/" + chapter.id + "/");
      await layout(chapter.id, width);
      if (chapter.id === "chapter-16") {
        const tableBlock = chapter.blocks.find(block => block.type === "table");
        const table = page.locator(`[id="${tableBlock.id}"]`);
        const cells = await table.locator("tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("th,td")].map(cell => cell.textContent)));
        assert.deepEqual(cells, tableBlock.rows, "Complete budget table at " + width);
        assert.ok(await table.locator("strong").count() > 0, "Budget total retains emphasis");
        await table.scrollIntoViewIfNeeded();
        await screenshot("table-ch16-" + width, table);
      }
      if (chapter.id === "chapter-12") {
        const notes = page.locator(".reading-notes");
        await notes.scrollIntoViewIfNeeded();
        await screenshot("notes-ch12-" + width, notes);
      }
    }
    console.log("Layout passed: " + width + "px, all twenty sections, read and contents");
  }
  assert.deepEqual(report.errors, [], "No browser exceptions or missing local resources");
  report.status = "passed";
  console.log(`Literary QA passed: ${report.pages.length} full texts, ${report.downloads.length} downloads, ${report.notes.length} note round-trips, ${report.layouts.length} layouts.`);
} catch (error) {
  report.status = "failed";
  report.failure = error.stack || String(error);
  console.error(report.failure);
  await screenshot("failure").catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(directory, "browser-qa.json"), JSON.stringify(report, null, 2) + "\n");
  await context.close();
  await browser.close();
}
