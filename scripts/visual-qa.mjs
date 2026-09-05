import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.SITE_URL || "http://127.0.0.1:3210/right-to-decide";
fs.mkdirSync("docs/design-references/site", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const errors = [];
const results = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(base))
      errors.push(r.status() + " " + r.url());
  });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/contents/",
      "/authors/",
      "/read/introduction/",
      "/read/chapter-12/",
      "/read/appendix-k/",
    ]) {
      await page.goto(base + route, { waitUntil: "networkidle" });
      await page.locator("h1").waitFor();
      for (const img of await page.locator("img").all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate((i) => i.decode());
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(
        overflow,
        false,
        "Horizontal overflow " + width + " " + route,
      );
      assert.equal(
        await page
          .locator("img")
          .evaluateAll((imgs) =>
            imgs.every((i) => i.complete && i.naturalWidth > 0),
          ),
        true,
        "Broken image " + route,
      );
      if (route !== "/read/appendix-k/")
        await page.screenshot({
          path:
            "docs/design-references/site/" +
            width +
            "-" +
            (route === "/"
              ? "home"
              : route.split("/").filter(Boolean).join("-")) +
            ".png",
          fullPage: route === "/" || route === "/authors/",
        });
      results.push({ width, route, overflow });
    }
  }
  await page.goto(base + "/contents/", { waitUntil: "networkidle" });
  await page.getByRole("searchbox").fill("неттакойглавы987");
  assert.equal(
    await page
      .getByText("Разделов по этому запросу не найдено.", { exact: false })
      .count(),
    1,
  );
  await page.getByRole("searchbox").fill("От знания");
  await page.getByRole("link", { name: /От знания к полномочию/ }).click();
  await page.waitForURL("**/read/chapter-01/");
  assert.match(await page.locator("h1").innerText(), /От знания к полномочию/);
  await page.getByRole("button", { name: "Крупный текст" }).click();
  assert.equal(
    await page
      .locator(".reading-copy")
      .evaluate((e) => getComputedStyle(e).fontSize),
    "22px",
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page
      .locator(".reading-copy")
      .evaluate((e) => getComputedStyle(e).fontSize),
    "22px",
  );
  await page.goto(base + "/read/", { waitUntil: "networkidle" });
  assert.equal(
    await page.getByRole("link", { name: /Продолжить: Глава 1/ }).count(),
    1,
  );
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Бизнесу", exact: true }).click();
  assert.equal(
    await page
      .getByRole("tab", { name: "Бизнесу", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Авторы", exact: true })
    .click();
  await page.waitForURL("**/authors/");
  assert.match(await page.locator("h1").innerText(), /Об авторах/);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "docs/research/visual-qa.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        results,
        checks: [
          "18 viewport/route combinations",
          "search empty and matching states",
          "chapter navigation",
          "font preference persists",
          "resume reading",
          "audience tabs",
          "mobile menu",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Visual QA passed: " +
      results.length +
      " layouts and functional checks, no browser errors.",
  );
} finally {
  await browser.close();
}
