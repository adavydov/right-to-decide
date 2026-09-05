import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = (process.env.SITE_URL || "http://127.0.0.1:3210/right-to-decide").replace(/\/$/, "");
const output = "docs/design-references/reader-fonts";
const settingsKey = "right-to-decide-settings";
const chapter = "chapter-12";
const choices = [
  { id: "literata", name: "Literata", platform: /literata/i },
  { id: "source-serif", name: "Source Serif 4", platform: /source.*serif/i },
  { id: "golos", name: "Golos Text", platform: /golos/i },
  { id: "serif", name: "Georgia", platform: /georgia/i },
  { id: "sans", name: "Arial", platform: /arial/i },
];
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = {
  checkedAt: new Date().toISOString(), base, status: "running",
  browser: "isolated headless Microsoft Edge contexts",
  checks: [], fonts: [], positions: [], screenshots: [], fontRequests: [], errors: [],
};
const fontRequests = new Set();
let activePage;

async function check(name, run) {
  console.log("Running: " + name);
  let watchdog;
  try {
    await Promise.race([run(), new Promise((_, reject) => {
      watchdog = setTimeout(() => reject(new Error("Check timeout: " + name)), 45000);
    })]);
    report.checks.push(name);
    console.log("Passed: " + name);
  } finally { clearTimeout(watchdog); }
}

async function newContext(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", ...options,
  });
  context.on("page", (page) => {
    activePage = page;
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(30000);
    page.on("pageerror", (error) => report.errors.push(error.message));
    page.on("request", (request) => {
      if (request.resourceType() === "font" || /\.woff2?(?:\?|$)/i.test(request.url()))
        fontRequests.add(request.url());
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && response.url().startsWith(base + "/"))
        report.errors.push(response.status() + " " + response.url());
    });
  });
  return context;
}

async function chapterReady(page) {
  await page.getByTestId("reader").waitFor();
  await page.locator(".reading-copy [data-reader-block]").first().waitFor();
  // Eager loading prevents decode() waiting forever on off-screen lazy images.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.querySelectorAll(".reading-copy img"), (image) => {
      image.loading = "eager";
      return image.decode().catch(() => {});
    }));
  });
  await page.waitForTimeout(850);
}

async function openChapter(page) {
  await page.goto(base + "/read/" + chapter + "/", { waitUntil: "domcontentloaded" });
  await chapterReady(page);
}

async function settings(page) {
  const panel = page.getByRole("dialog", { name: "Настройки чтения", exact: true });
  if (!await panel.isVisible()) {
    await page.getByTestId("reader-toolbar").getByRole("button", { name: "Настройки чтения", exact: true }).click();
    await panel.waitFor();
  }
  assert.equal(await panel.evaluate((element) => element.matches(":modal")), true, "Settings use a native modal dialog");
  return panel;
}

async function fontMenu(page) {
  const panel = await settings(page);
  const summary = panel.locator('[data-reader-font-picker-summary]');
  if (!await summary.evaluate((element) => element.parentElement.open)) await summary.click();
  await panel.locator("[data-reader-font-choice]").first().waitFor();
  return panel;
}

async function closeSettings(page) {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Настройки чтения", exact: true }).waitFor({ state: "hidden" });
}

async function appliedFont(page, id, family) {
  await page.waitForFunction(({ key, id, family }) => {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    const copy = document.querySelector(".reading-copy");
    return saved?.font === id && copy && getComputedStyle(copy).fontFamily === family;
  }, { key: settingsKey, id, family });
}

async function chooseFont(page, choice) {
  const panel = await fontMenu(page);
  const button = panel.getByRole("button", { name: choice.name, exact: true });
  const family = await button.locator("[data-reader-font-sample]").evaluate((element) => getComputedStyle(element).fontFamily);
  await button.click();
  assert.equal(await panel.locator('[data-reader-font-picker-summary]').evaluate((element) => element.parentElement.open), false, "Selecting a font collapses previews");
  await appliedFont(page, choice.id, family);
  assert.equal(await panel.locator('[data-reader-font-choice="' + choice.id + '"]').getAttribute("aria-pressed"), "true", choice.name + " is selected");
  return family;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const blocks = [...document.querySelectorAll(".reading-copy [data-reader-block]")];
    const index = Math.max(0, blocks.findIndex((block) => block.getBoundingClientRect().bottom > 112));
    const block = blocks[index];
    const bounds = block.getBoundingClientRect();
    return { id: block.id, index, top: bounds.top, height: bounds.height, scrollY };
  });
}

async function midpoint(page) {
  await page.getByRole("slider", { name: "Прогресс главы", exact: true }).fill("55");
  await page.waitForTimeout(1300);
  const position = await snapshot(page);
  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem("right-to-decide-position:" + id) || "null"), chapter);
  assert.ok(position.index > 2 && saved?.progress > 0.5 && saved.progress < 0.6, "Midchapter position has been saved");
  return position;
}

async function samePassage(page, expected, label) {
  await page.waitForTimeout(850);
  const actual = await snapshot(page);
  const stillVisible = await page.evaluate((id) => {
    const bounds = document.getElementById(id)?.getBoundingClientRect();
    return bounds && bounds.top < innerHeight * 0.75 && bounds.bottom > 112;
  }, expected.id);
  assert.ok(actual.id === expected.id || Math.abs(actual.index - expected.index) <= 1 || stillVisible,
    label + ": expected " + JSON.stringify(expected) + "; actual " + JSON.stringify(actual));
  report.positions.push({ label, expected, actual });
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, name + ".png"), fullPage: false });
  report.screenshots.push(name + ".png");
}

async function inspectPlatformFont(context, page, choice, family, style, weight) {
  // Cyrillic-only probes verify glyph rendering, not just the requested CSS name.
  await page.evaluate(async ({ family, style, weight }) => {
    const probe = document.createElement("span");
    probe.id = "reader-font-qa-probe";
    probe.textContent = "Съешь ещё этих мягких французских булок. Ёё";
    Object.assign(probe.style, { fontFamily: family, fontSize: "24px", fontStyle: style, fontWeight: weight });
    document.querySelector(".reading-copy").append(probe);
    await document.fonts.load(style + " " + weight + " 24px " + family, probe.textContent);
  }, { family, style, weight });
  const session = await context.newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#reader-font-qa-probe" });
    const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
    assert.ok(fonts.length > 0, choice.name + " reports rendered glyphs");
    assert.ok(fonts.every((font) => font.isCustomFont && choice.platform.test(font.familyName) && font.glyphCount > 0),
      choice.name + " Cyrillic uses its local webfont at " + style + "/" + weight + ": " + JSON.stringify(fonts));
    const faces = await page.evaluate(({ family }) => [...document.fonts]
      .filter((face) => family.includes(face.family.replaceAll('"', "")))
      .map((face) => ({ family: face.family, style: face.style, weight: face.weight, status: face.status })), { family });
    if (style === "italic" && choice.id !== "golos")
      assert.ok(faces.some((face) => face.style === "italic" && face.status === "loaded"), choice.name + " loads its authored italic face");
    report.fonts.push({ id: choice.id, family, style, weight, platformFonts: fonts, faces });
  } finally {
    await session.detach();
    await page.locator("#reader-font-qa-probe").evaluate((element) => element.remove());
  }
}

try {
  const context = await newContext();
  const page = await context.newPage();
  await openChapter(page);

  await check("Five named fonts share an identical preview in their own typeface", async () => {
    const panel = await fontMenu(page);
    assert.equal(await panel.locator("[data-reader-font-choice]").count(), 5);
    const samples = await panel.locator("[data-reader-font-sample]").evaluateAll((elements) => elements.map((element) => ({
      text: element.textContent, family: getComputedStyle(element).fontFamily,
    })));
    assert.equal(new Set(samples.map((sample) => sample.text)).size, 1, "Preview wording is identical");
    assert.ok(samples[0].text.length > 40 && /[А-Яа-яЁё]/u.test(samples[0].text), "Preview is a readable Russian passage");
    assert.equal(new Set(samples.map((sample) => sample.family)).size, 5, "Each card uses a distinct font family");
    for (const choice of choices) {
      const button = panel.getByRole("button", { name: choice.name, exact: true });
      assert.equal(await button.getAttribute("data-reader-font-choice"), choice.id);
      assert.equal(await button.getAttribute("aria-pressed"), String(choice.id === "serif"));
    }
    await page.evaluate(() => document.fonts.ready);
    await screenshot(page, "desktop-font-previews");
    await closeSettings(page);
  });

  for (const choice of choices.slice(0, 3)) {
    await check(choice.name + " applies real Cyrillic glyphs, weights and italics", async () => {
      const family = await chooseFont(page, choice);
      await closeSettings(page);
      for (const [style, weight] of [["normal", "400"], ["normal", "700"], ["italic", "400"]])
        await inspectPlatformFont(context, page, choice, family, style, weight);
      await screenshot(page, "desktop-reading-" + choice.id);
    });
    await check(choice.name + " preserves the current passage on selection and reload", async () => {
      await chooseFont(page, choices[3]);
      await closeSettings(page);
      const expected = await midpoint(page);
      const family = await chooseFont(page, choice);
      await closeSettings(page);
      await samePassage(page, expected, choice.name + " selection");
      const beforeReload = await snapshot(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await chapterReady(page);
      await appliedFont(page, choice.id, family);
      await samePassage(page, beforeReload, choice.name + " reload");
    });
  }

  await check("A saved new font restores the passage with a cold cache and delayed font requests", async () => {
    const family = await chooseFont(page, choices[0]);
    await closeSettings(page);
    const expected = await midpoint(page);
    const cold = await newContext({ storageState: await context.storageState() });
    let delayed = 0;
    await cold.route(/\.woff2(?:\?|$)/i, async (route) => {
      delayed++;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    try {
      const coldPage = await cold.newPage();
      await openChapter(coldPage);
      await appliedFont(coldPage, "literata", family);
      assert.ok(delayed > 0, "The cold browser requested delayed font files");
      await samePassage(coldPage, expected, "Cold delayed Literata restoration");
      await screenshot(coldPage, "cold-delayed-restored-passage");
    } finally { await cold.close(); activePage = page; }
  });


  await check("Font download timeout keeps the saved passage stable after the late font arrives", async () => {
    const family = await chooseFont(page, choices[0]);
    await closeSettings(page);
    const expected = await midpoint(page);
    const slow = await newContext({ storageState: await context.storageState() });
    let delayed = 0;
    await slow.route(/\.woff2(?:\?|$)/i, async (route) => {
      delayed++;
      await new Promise((resolve) => setTimeout(resolve, 9500));
      await route.continue();
    });
    try {
      const slowPage = await slow.newPage();
      await slowPage.goto(base + "/read/" + chapter + "/", { waitUntil: "domcontentloaded" });
      await slowPage.getByTestId("reader").waitFor();
      await slowPage.locator(".reading-copy [data-reader-block]").first().waitFor();
      // Do not await fonts.ready here: observe the 8 s timeout before the 9.5 s response.
      await slowPage.evaluate(() => {
        for (const image of document.querySelectorAll(".reading-copy img")) image.loading = "eager";
      });
      await slowPage.waitForTimeout(8600);
      const fallback = await slowPage.locator(".reading-copy").evaluate((element) => getComputedStyle(element).fontFamily);
      assert.match(fallback, /Georgia/i, "A timed-out initial font uses a stable Georgia fallback");
      assert.notEqual(fallback, family);
      const beforeLateFont = await snapshot(slowPage);
      await slowPage.evaluate(() => document.fonts.ready);
      await slowPage.waitForTimeout(800);
      assert.ok(delayed > 0, "Saved font was delayed beyond its timeout");
      assert.equal(await slowPage.locator(".reading-copy").evaluate((element) => getComputedStyle(element).fontFamily), fallback,
        "Late CSS font completion does not silently change the active font");
      await samePassage(slowPage, beforeLateFont, "Late font arrival after timeout");
      await samePassage(slowPage, expected, "Saved passage survives initial timeout");
      await screenshot(slowPage, "slow-font-stable-fallback");
    } finally { await slow.close(); activePage = page; }
  });

  await check("390 px settings previews fit the viewport and keep controls usable", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const panel = await fontMenu(page);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "No page horizontal overflow");
    assert.equal(await panel.evaluate((element) => element.scrollWidth > element.clientWidth + 1), false, "No dialog horizontal overflow");
    const bounds = await panel.boundingBox();
    assert.ok(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= 391 && bounds.y + bounds.height <= 845, "Dialog fits the phone viewport");
    for (const choice of choices) {
      const button = panel.getByRole("button", { name: choice.name, exact: true });
      await button.scrollIntoViewIfNeeded();
      const card = await button.boundingBox();
      assert.ok(card && card.x >= 0 && card.x + card.width <= 391 && card.height >= 44, choice.name + " is a reachable touch target");
    }
    await panel.locator('[data-reader-font-picker-summary]').scrollIntoViewIfNeeded();
    await screenshot(page, "mobile-font-previews");
    await chooseFont(page, choices[2]);
    await closeSettings(page);
    await screenshot(page, "mobile-reading-golos");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Selected font does not overflow the reading page");
  });
  await context.close();
  activePage = undefined;

  for (const choice of choices.slice(3)) {
    await check("Legacy " + choice.id + " preference retains " + choice.name, async () => {
      const legacy = await newContext();
      await legacy.addInitScript(({ key, font, origin }) => {
        if (location.origin !== origin) return;
        localStorage.setItem(key, JSON.stringify({
          theme: "sepia", font, size: 24, spacing: 1.8, width: "normal",
        }));
      }, { key: settingsKey, font: choice.id, origin: new URL(base).origin });
      try {
        const legacyPage = await legacy.newPage();
        await openChapter(legacyPage);
        const copy = await legacyPage.locator(".reading-copy").evaluate((element) => ({
          family: getComputedStyle(element).fontFamily, size: getComputedStyle(element).fontSize,
        }));
        assert.match(copy.family, choice.platform);
        assert.equal(copy.size, "24px");
        const panel = await fontMenu(legacyPage);
        assert.equal(await panel.getByRole("button", { name: choice.name, exact: true }).getAttribute("aria-pressed"), "true");
      } finally { await legacy.close(); activePage = undefined; }
    });
  }


  await check("Changing theme and size during font loading preserves all three settings", async () => {
    const pending = await newContext();
    let delayed = 0;
    await pending.route(/\.woff2(?:\?|$)/i, async (route) => {
      delayed++;
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    try {
      const pendingPage = await pending.newPage();
      await openChapter(pendingPage);
      delayed = 0;
      const panel = await fontMenu(pendingPage);
      const literata = panel.getByRole("button", { name: "Literata", exact: true });
      const family = await literata.locator("[data-reader-font-sample]").evaluate((element) => getComputedStyle(element).fontFamily);
      await literata.click();
      await panel.getByRole("button", { name: "Сепия", exact: true }).click();
      await panel.getByRole("slider", { name: "Размер текста", exact: true }).fill("24");
      await appliedFont(pendingPage, "literata", family);
      const saved = await pendingPage.evaluate((key) => JSON.parse(localStorage.getItem(key)), settingsKey);
      assert.equal(saved.theme, "sepia");
      assert.equal(saved.size, 24);
      assert.equal(await pendingPage.getByTestId("reader").getAttribute("data-theme"), "sepia");
      assert.equal(await pendingPage.locator(".reading-copy").evaluate((element) => getComputedStyle(element).fontSize), "24px");
      assert.ok(delayed > 0, "The font was still downloading during the other setting changes");
    } finally { await pending.close(); activePage = undefined; }
  });

  await check("A later Arial choice wins while an earlier webfont is still loading", async () => {
    const racing = await newContext();
    let delayed = 0;
    await racing.route(/\.woff2(?:\?|$)/i, async (route) => {
      delayed++;
      await new Promise((resolve) => setTimeout(resolve, 1800));
      await route.continue();
    });
    try {
      const racePage = await racing.newPage();
      await openChapter(racePage);
      delayed = 0;
      let panel = await fontMenu(racePage);
      await panel.getByRole("button", { name: "Literata", exact: true }).click();
      panel = await fontMenu(racePage);
      const arial = panel.getByRole("button", { name: "Arial", exact: true });
      const family = await arial.locator("[data-reader-font-sample]").evaluate((element) => getComputedStyle(element).fontFamily);
      await arial.click();
      await appliedFont(racePage, "sans", family);
      await racePage.waitForTimeout(2200);
      await appliedFont(racePage, "sans", family);
      assert.ok(delayed > 0, "Earlier webfont had a delayed network request");
    } finally { await racing.close(); activePage = undefined; }
  });

  await check("A failed font request keeps the previous font and gives a retry notice", async () => {
    const failing = await newContext();
    await failing.route(/\.woff2(?:\?|$)/i, (route) => route.abort("failed"));
    try {
      const failedPage = await failing.newPage();
      await openChapter(failedPage);
      const before = await failedPage.locator(".reading-copy").evaluate((element) => getComputedStyle(element).fontFamily);
      const panel = await fontMenu(failedPage);
      await panel.getByRole("button", { name: "Literata", exact: true }).click();
      await failedPage.getByText("Не удалось загрузить шрифт. Попробуйте ещё раз.", { exact: true }).waitFor();
      assert.equal(await failedPage.locator(".reading-copy").evaluate((element) => getComputedStyle(element).fontFamily), before);
      assert.equal(await failedPage.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").font || "serif", settingsKey), "serif");
      await screenshot(failedPage, "font-failure-retry-notice");
    } finally { await failing.close(); activePage = undefined; }
  });

  await check("Fonts are served locally with no external font requests or browser errors", async () => {
    report.fontRequests = [...fontRequests].sort();
    assert.ok(report.fontRequests.length >= 5, "Normal and italic local resources were exercised");
    for (const url of report.fontRequests)
      assert.ok(url.startsWith(base + "/_next/"), "Font is a site-owned Next asset: " + url);
    assert.deepEqual(report.errors, []);
  });
  report.status = "passed";
  console.log("Reader fonts QA passed: " + report.checks.length + " checks.");
} catch (error) {
  report.status = "failed";
  report.failure = error.stack || String(error);
  if (activePage && !activePage.isClosed())
    await activePage.screenshot({ path: path.join(output, "failure.png"), timeout: 10000 }).catch(() => {});
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  report.fontRequests = [...fontRequests].sort();
  fs.writeFileSync(path.join(output, "qa.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
