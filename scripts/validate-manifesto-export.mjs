import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const canonical = fs.readFileSync("CONSTITUTION.md");
const download = fs.readFileSync("out/manifesto/constitution.md");
assert.deepEqual(download, canonical, "The public Markdown must exactly match CONSTITUTION.md");
const wordName = "Pravo_na_reshenie_Manifest_Constitution_v1.2.1.docx";
assert.deepEqual(fs.readFileSync("out/manifesto/" + wordName), fs.readFileSync("public/manifesto/" + wordName),
  "The Word download must preserve the verified reader copy");
execFileSync("python", ["scripts/constitution_docx.py", "--check"], { stdio: "inherit" });

const isV10 = JSON.parse(fs.readFileSync("src/data/book.json","utf8")).editionVersion === "10.0";
const html = fs.readFileSync(isV10 ? "out/editions/v9/manifesto/index.html" : "out/manifesto/index.html", "utf8");
const article = html.match(/<article\b[^>]*aria-label="Полный авторский текст конституции"[^>]*>([\s\S]*?)<\/article>/)?.[1];
assert.ok(article, "The manifesto needs a complete, labelled author document");
const normalize = (text) => text.replace(/\s+/gu, " ").trim();
const unescape = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
  if (entity[0] === "#") return String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase() === "x" ? 2 : 1), entity[1].toLowerCase() === "x" ? 16 : 10));
  return { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " }[entity.toLowerCase()];
});
const expected = canonical.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/)
  .filter((line) => line.trim() !== "---")
  .map((line) => line.replace(/^#{1,6}\s+/, "").replace(/^>\s?/, "").replaceAll("**", "").replaceAll("`", ""))
  .join(" ");
const rendered = unescape(article.replace(/<!--[\s\S]*?-->/g, "").replace(/<\/(?:h[1-6]|p|blockquote|code|strong|a)>/g, (tag) => /<\/(?:h[1-6]|p|blockquote)>/.test(tag) ? " " : "").replace(/<[^>]*>/g, ""));
assert.equal(normalize(rendered), normalize(expected), "The complete rendered author text must retain wording and order");

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
for (const asset of ["constitution.md", wordName]) {
  assert.ok(html.includes('href="' + base + "/manifesto/" + asset + '"'), "Missing manifesto download " + asset);
}
assert.ok(html.includes("Нон-фикшн: редакция для принятия соавторами"), "Preserve the original authorship status");
assert.ok(html.includes("Обновление конституции не означает повторной приёмки ранее написанных глав."), "Do not reapprove chapters by publishing the constitution");
assert.ok(fs.readFileSync("out/sitemap.xml", "utf8").includes("/manifesto/"), "The manifesto belongs in the sitemap");
console.log("Manifesto passed: exact canonical Markdown, verified complete Word copy, rendered text and publication status.");
