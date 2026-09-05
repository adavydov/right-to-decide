import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = (process.env.SITE_URL || "http://127.0.0.1:3210/right-to-decide").replace(/\/$/, "");
const output = "docs/design-references/kobo-reader";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = {
  checkedAt: new Date().toISOString(), base, status: "running",
  browser: "isolated headless Microsoft Edge context",
  checks: [], layouts: [], errors: [],
};

function observe(page, scope) {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  page.on("pageerror", (error) => report.errors.push(scope + ": " + error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().startsWith(base + "/"))
      report.errors.push(scope + ": " + response.status() + " " + response.url());
  });
}
async function check(name, run) {
  if (process.env.READER_QA_ONLY && !name.includes(process.env.READER_QA_ONLY)) return;
  console.log("Running: " + name);
  let watchdog;
  try {
    await Promise.race([run(), new Promise((_, reject) => {
      watchdog = setTimeout(() => reject(new Error("Node-level check timeout: " + name)), 35000);
    })]);
  } finally { clearTimeout(watchdog); }
  report.checks.push(name);
  console.log("Passed: " + name);
}
async function openChapter(page, id, hash = "") {
  await page.goto(base + "/read/" + id + "/" + hash, { waitUntil: "networkidle" });
  await page.getByTestId("reader").waitFor();
  await page.locator(".reading-copy [data-reader-block]").first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.querySelectorAll(".reading-copy img"), (image) => { image.loading = "eager"; return image.decode().catch(() => {}); }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function openPanel(page, name) {
  await page.getByTestId("reader-toolbar").getByRole("button", { name, exact: true }).click();
  const panel = page.getByRole("dialog", { name, exact: true });
  await panel.waitFor();
  assert.equal(await panel.evaluate((element) => element.matches(":modal")), true, name + " is modal");
  return panel;
}
async function closePanel(page, name) {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name, exact: true }).waitFor({ state: "hidden" });
  await page.waitForFunction((buttonName) => {
    const toolbar = document.querySelector('[data-testid="reader-toolbar"]');
    const active = document.activeElement;
    return toolbar?.contains(active) &&
      (active.getAttribute("aria-label") === buttonName || active.textContent.trim() === buttonName);
  }, name);
}
async function setRange(slider, requested) {
  const minimum = Number((await slider.getAttribute("min")) ?? 0);
  const maximum = Number((await slider.getAttribute("max")) ?? 100);
  const step = Number((await slider.getAttribute("step")) ?? 1);
  const target = Math.min(maximum, Math.max(minimum, requested));
  assert.ok(step > 0 && Number.isFinite(step), "Valid range step: " + step);

  await slider.focus();
  await slider.press("Home");
  for (let index = 0; index < Math.round((target - minimum) / step); index++)
    await slider.press("ArrowRight");
  await slider.press("Tab");
  assert.equal(Number(await slider.inputValue()), target, "Keyboard range adjustment");
}
async function moveToProgress(page, progress) {
  await page.getByRole("slider", { name: "Прогресс главы", exact: true }).fill(String(progress));
  await page.waitForFunction(() => window.scrollY > 0);

  await waitSaved(page);

}
async function waitSaved(page) {
  await page.waitForTimeout(1300);
  const position = await page.evaluate(() => {
    const chapter = location.pathname.split("/").filter(Boolean).at(-1);
    const raw = window.localStorage.getItem("right-to-decide-position:" + chapter);
    const maximum = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    return { saved: raw ? JSON.parse(raw) : null, actual: scrollY / maximum, blocks: document.querySelectorAll("[data-reader-block]").length };
  });
  assert.ok(position.saved && Math.abs(position.saved.progress - position.actual) < 0.005, "Position persists after debounce: " + JSON.stringify(position));
}
async function locationSnapshot(page) {
  return page.evaluate(() => {
    const blocks = [...document.querySelectorAll(".reading-copy [data-reader-block]")];
    const index = blocks.findIndex((block) => block.getBoundingClientRect().bottom > 112);
    const block = blocks[Math.max(index, 0)];
    return { id: block.id, index, top: block.getBoundingClientRect().top, count: blocks.length };
  });
}
async function expectLocation(page, expected, label) {
  await page.waitForTimeout(700);
  const actual = await locationSnapshot(page);
  const targetVisible = await page.evaluate((id) => {
    const target = document.getElementById(id);
    if (!target) return false;
    const bounds = target.getBoundingClientRect();
    return bounds.top < innerHeight * 0.75 && bounds.bottom > 112;
  }, expected.id);
  assert.ok(Math.abs(actual.index - expected.index) <= 1 || targetVisible, label + ": expected " + JSON.stringify(expected) + "; actual " + JSON.stringify(actual));
  report.checks.push(label + ": " + expected.id + " → " + actual.id);
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, name + ".png"), fullPage: false });
}
async function assertLayout(page, name) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Horizontal overflow: " + name);
  assert.equal(await page.locator(".reading-copy img").evaluateAll((images) =>
    images.every((image) => image.complete && image.naturalWidth > 0)), true, "Broken manuscript image: " + name);
  assert.equal(await page.locator("body > header, body > footer").evaluateAll((elements) => elements.some((element) => getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden")), false, "Marketing header/footer hidden in reader: " + name);
  const size = page.viewportSize();
  for (const id of ["reader-toolbar", "reader-footer"]) {
    const bounds = await page.getByTestId(id).boundingBox();
    assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= size.width + 1, id + " fits " + name);
  }
}

let activePage;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  activePage = page;
  observe(page, "main");

  await check("Nine responsive reader layouts, images and tables", async () => {
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const chapter of ["introduction", "chapter-12", "appendix-k"]) {
        await openChapter(page, chapter);
        await assertLayout(page, width + "/" + chapter);
        await screenshot(page, width + "-" + chapter);
        report.layouts.push({ width, chapter });
      }
    }
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openChapter(page, "chapter-12");
  await check("Settings keyboard controls, theme/font persistence and Escape focus", async () => {
    const settings = await openPanel(page, "Настройки чтения");
    await setRange(settings.getByRole("slider", { name: "Размер текста", exact: true }), 24);
    for (const name of ["Без засечек", "Сепия", "Широкая"])
      await settings.getByRole("button", { name, exact: true }).click();
    await screenshot(page, "desktop-settings-sepia");
    await closePanel(page, "Настройки чтения");
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".reading-copy")).fontSize === "24px");
    const font = await page.locator(".reading-copy").evaluate((element) => getComputedStyle(element).fontFamily);
    await page.reload({ waitUntil: "networkidle" });
    const restored = await openPanel(page, "Настройки чтения");
    assert.equal(await restored.getByRole("slider", { name: "Размер текста", exact: true }).inputValue(), "24");
    for (const name of ["Без засечек", "Сепия", "Широкая"])
      assert.equal(await restored.getByRole("button", { name, exact: true }).getAttribute("aria-pressed"), "true", name + " persists");
    assert.equal(await page.locator(".reading-copy").evaluate((element) => getComputedStyle(element).fontFamily), font);
    await restored.getByRole("button", { name: "Тёмная", exact: true }).click();
    await closePanel(page, "Настройки чтения");
    await screenshot(page, "desktop-dark");
    const reset = await openPanel(page, "Настройки чтения");
    await reset.getByRole("button", { name: "Сбросить настройки", exact: true }).click();
    await closePanel(page, "Настройки чтения");
  });

  await check("Midchapter reload and independent chapter locations", async () => {
    await moveToProgress(page, 55);
    const saved = await locationSnapshot(page);
    assert.ok(saved.index > 0, "Progress control moves into the chapter");
    await page.reload({ waitUntil: "networkidle" });
    await expectLocation(page, saved, "Reload restores location");
    await openChapter(page, "chapter-01");
    await moveToProgress(page, 40);
    const other = await locationSnapshot(page);
    await openChapter(page, "chapter-12");
    await expectLocation(page, saved, "Chapter keeps its own location");
    await openChapter(page, "chapter-01");
    await expectLocation(page, other, "Second chapter keeps a separate location");
  });

  await openChapter(page, "chapter-12");
  await check("Bookmark save, jump and delete", async () => {
    await moveToProgress(page, 50);
    const marked = await locationSnapshot(page);
    const panel = await openPanel(page, "Закладки");
    await panel.getByRole("button", { name: "Добавить закладку здесь", exact: true }).click();
    if (await panel.isVisible()) await closePanel(page, "Закладки");
    await moveToProgress(page, 80);
    const bookmarks = await openPanel(page, "Закладки");
    await bookmarks.getByRole("button", { name: /^Открыть закладку:/ }).first().click();
    await bookmarks.waitFor({ state: "hidden" });
    await expectLocation(page, marked, "Bookmark restores passage");
    const remove = await openPanel(page, "Закладки");
    const before = await remove.getByRole("button", { name: /^Открыть закладку:/ }).count();
    await remove.getByRole("button", { name: /^Удалить закладку:/ }).first().click();
    assert.equal(await remove.getByRole("button", { name: /^Открыть закладку:/ }).count(), before - 1);
    await closePanel(page, "Закладки");
  });

  await check("Search empty state and navigation to manuscript passage", async () => {
    const term = await page.locator(".reading-copy [data-reader-block]").evaluateAll((blocks) => {
      for (const block of blocks.slice(Math.floor(blocks.length / 2))) {
        const word = block.textContent.match(/[А-Яа-яЁё]{10,}/u)?.[0];
        if (word) return word;
      }
      return "решение";
    });
    const search = await openPanel(page, "Поиск по главе");
    const field = search.getByRole("searchbox", { name: "Поиск по главе", exact: true });
    await field.fill("неттакогофрагмента987654321");
    assert.equal(await search.locator("[data-reader-search-result]").count(), 0);
    await field.fill(term);
    const first = search.locator("[data-reader-search-result]").first();
    await first.waitFor();
    await screenshot(page, "desktop-search");
    await first.click();
    await search.waitFor({ state: "hidden" });
    await page.waitForFunction((needle) => {
      const visible = [...document.querySelectorAll(".reading-copy [data-reader-block]")]
        .filter((block) => { const bounds = block.getBoundingClientRect(); return bounds.bottom > 80 && bounds.top < innerHeight - 70; })
        .map((block) => block.textContent).join(" ").toLocaleLowerCase("ru");
      return visible.includes(needle.toLocaleLowerCase("ru"));
    }, term);
  });

  await check("Explicit fragment takes precedence over stored progress", async () => {
    await openChapter(page, "chapter-12");
    await moveToProgress(page, 80);
    const id = await page.locator(".reading-copy [data-reader-block]").nth(2).getAttribute("id");
    assert.ok(id, "Blocks expose URL anchors");
    await openChapter(page, "chapter-12", "#" + encodeURIComponent(id));
    await page.waitForFunction((blockId) => {
      const bounds = document.getElementById(blockId)?.getBoundingClientRect();
      return bounds && bounds.top >= -5 && bounds.top < innerHeight / 2;
    }, id);
  });

  await check("TOC route transition, resume link and focus mode", async () => {
    const contents = await openPanel(page, "Содержание");
    await contents.locator('a[href$="/read/chapter-01/"]').click();
    await page.waitForURL("**/read/chapter-01/");
    await page.getByTestId("reader").waitFor();
    assert.match(await page.locator("h1").innerText(), /Глава 1/);
    await page.getByRole("button", { name: "Режим сосредоточенного чтения", exact: true }).click();
    const restore = page.getByRole("button", { name: "Показать управление", exact: true });
    await restore.waitFor();
    assert.equal(await page.getByTestId("reader-toolbar").getAttribute("inert"), "");
    await screenshot(page, "desktop-focus");
    await restore.click();
    await page.getByTestId("reader-toolbar").waitFor();

  await waitSaved(page);

    await page.goto(base + "/read/", { waitUntil: "networkidle" });
    const resume = page.getByRole("link", { name: /Продолжить/ }).filter({ hasText: /Глава 1/ });
    await resume.waitFor();
    await resume.click();
    await page.waitForURL("**/read/chapter-01/**");
  });

  await check("Mobile settings and TOC stay in viewport", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openChapter(page, "chapter-12");
    for (const name of ["Настройки чтения", "Содержание"]) {
      const panel = await openPanel(page, name);
      const bounds = await panel.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 391 && bounds.y + bounds.height <= 845, name + " fits mobile");
      await screenshot(page, name === "Содержание" ? "mobile-contents" : "mobile-settings");
      await closePanel(page, name);
    }
  });
  await context.close();
  activePage = undefined;

  for (const mode of ["corrupt", "blocked", "quota"]) {
    await check("Reader survives " + mode + " storage in a fresh isolated context", async () => {
      const isolated = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
      await isolated.addInitScript((storageMode) => {
        if (storageMode === "blocked") {
          Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("QA storage denied", "SecurityError"); } });
        } else if (storageMode === "quota") {
          Storage.prototype.setItem = function () { throw new DOMException("QA quota exceeded", "QuotaExceededError"); };
        } else {
          const original = Storage.prototype.getItem;
          Storage.prototype.getItem = function (key) {
            const existing = original.call(this, key);
            return existing ?? (String(key).startsWith("right-to-decide") ? "{invalid-reader-data" : null);
          };
        }
      }, mode);
      const isolatedPage = await isolated.newPage();
      activePage = isolatedPage;
      observe(isolatedPage, mode);
      try {
        await openChapter(isolatedPage, "introduction");
        await assertLayout(isolatedPage, mode);
        const settings = await openPanel(isolatedPage, "Настройки чтения");
        await settings.getByRole("button", { name: "Тёмная", exact: true }).click();
        assert.equal(await settings.getByRole("button", { name: "Тёмная", exact: true }).getAttribute("aria-pressed"), "true");
        await closePanel(isolatedPage, "Настройки чтения");
      } finally {
        await isolated.close();
        activePage = undefined;
      }
    });
  }
  assert.deepEqual(report.errors, [], "No browser exceptions or failed local resources");
  report.status = "passed";
  console.log("Reader QA passed: " + report.layouts.length + " layouts and " + report.checks.length + " checks.");
} catch (error) {
  report.status = "failed";
  report.failure = error.stack || String(error);
  if (activePage && !activePage.isClosed())
    await activePage.screenshot({ path: path.join(output, "failure.png"), timeout: 10000 }).catch(() => {});
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(output, "reader-qa.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
