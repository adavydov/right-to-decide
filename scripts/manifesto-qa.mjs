import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = (process.env.SITE_URL || "http://127.0.0.1:3210/right-to-decide").replace(/\/$/, "");
const destination = "temp/manifesto-qa";
fs.mkdirSync(destination, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400 && response.url().startsWith(base + "/")) errors.push(response.status() + " " + response.url());
});

try {
  for (const width of [1440, 1100, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    const response = await page.goto(base + "/manifesto/", { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    const measurements = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
    assert.ok(measurements.width <= width + 1, "Horizontal overflow at " + width);
    assert.equal(await page.locator("main h1").count(), 1);
    assert.ok((await page.locator("[data-manifesto-block=heading]").allTextContents()).some((text) => text.startsWith("С08. Омега")));
    if (width > 1050) {
      await page.locator("#book-navigation").getByRole("link", { name: "Манифест", exact: true }).waitFor({ state: "visible" });
    } else {
      const contents = page.locator("main details");
      await contents.locator("summary").click();
      await contents.getByRole("link", { name: "5. Восемь слоёв одной книги", exact: true }).click();
      const heading = page.getByRole("heading", { name: "5. Восемь слоёв одной книги", exact: true });
      const top = await heading.evaluate((element) => element.getBoundingClientRect().top);
      assert.ok(top >= 90 && top < 200, "Section anchor clears the fixed header at " + width + ": " + top);
      await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
      const link = page.locator("#book-navigation").getByRole("link", { name: "Манифест", exact: true });
      await link.click();
      assert.equal(await page.getByRole("button", { name: "Открыть меню", exact: true }).getAttribute("aria-expanded"), "false");
      await page.goto(base + "/manifesto/", { waitUntil: "networkidle" });
    }
    await page.screenshot({ path: destination + "/manifesto-" + width + ".png" });
    console.log("Manifesto layout and navigation passed: " + width);
  }
  const canonical = fs.readFileSync("CONSTITUTION.md");
  const download = await page.request.get(base + "/manifesto/constitution.md");
  assert.equal(download.status(), 200);
  assert.deepEqual(await download.body(), canonical);
  const word = await page.request.get(base + "/manifesto/Pravo_na_reshenie_Manifest_Constitution_v1.0.docx");
  assert.equal(word.status(), 200);
  assert.deepEqual(await word.body(), fs.readFileSync("public/manifesto/Pravo_na_reshenie_Manifest_Constitution_v1.0.docx"));
  await page.goto(base + "/contents/", { waitUntil: "networkidle" });
  const groupIds = await page.locator("main section").evaluateAll((sections) => sections.map((section) => section.id));
  assert.equal(groupIds.at(-1), "epilogue-section", "The epilogue must follow the six parts");
  const epilogue = page.locator("#epilogue");
  assert.ok((await epilogue.innerText()).includes("В плане"));
  assert.equal(await epilogue.locator("a").count(), 0, "A planned epilogue has no reader link");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(base + "/authors/#literary-team", { waitUntil: "networkidle" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Editorial team overflow at " + width);
    const team = page.locator("#literary-team");
    assert.ok((await team.innerText()).includes("Восемь кураторов слоёв"));
    assert.ok((await team.innerText()).includes("Назначения не подтверждены; пилот не объявлен запущенным."));
    assert.equal(await team.locator("dt").filter({ hasText: /^С0[1-8]\./ }).count(), 8);
    await page.screenshot({ path: destination + "/authors-" + width + ".png" });
  }
  assert.deepEqual(errors, []);
  console.log("Manifesto browser QA passed: five layouts, navigation, anchor, source downloads, planned epilogue, eight curators, human pilot responsibilities and no browser errors.");
} finally {
  await browser.close();
}
