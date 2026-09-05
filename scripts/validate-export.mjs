import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const book = JSON.parse(fs.readFileSync("src/data/book.json", "utf8"));
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const routes = [
  "/",
  "/contents/",
  "/authors/",
  "/read/",
  ...book.chapters
    .filter((c) => c.id !== "source-contents" && c.status === "available")
    .map((c) => "/read/" + c.id + "/"),
];
function exists(url) {
  const raw = decodeURIComponent(url.split(/[?#]/)[0]);
  const local =
    base && raw.startsWith(base + "/") ? raw.slice(base.length) : raw;
  if (!local.startsWith("/")) return true;
  const p = path.join("out", local);
  return (
    fs.existsSync(p) &&
    (fs.statSync(p).isFile() || fs.existsSync(path.join(p, "index.html")))
  );
}
for (const route of routes) {
  const file = path.join("out", route, "index.html");
  assert.ok(fs.existsSync(file), "Missing route " + route);
  const html = fs.readFileSync(file, "utf8");
  assert.ok(html.includes('id="main-content"'), "No main content " + route);
  assert.ok(html.includes("Право на решение"), "No book identity " + route);
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (m[1].startsWith("/"))
      assert.ok(exists(m[1]), "Broken resource " + m[1] + " in " + route);
  }
}
for (const c of book.chapters.filter(
  (c) => c.id !== "source-contents" && c.status === "available",
)) {
  const html = fs.readFileSync(
    path.join("out/read", c.id, "index.html"),
    "utf8",
  );
  for (const b of c.blocks.filter((b) => b.type === "image"))
    assert.ok(html.includes(b.src), "Missing chapter figure " + b.src);
}
const authorsHtml = fs.readFileSync("out/authors/index.html", "utf8");
for (const name of [
  "Алексей Михайлович",
  "Алексей Алексеевич",
  "Егор Алексеевич",
])
  assert.ok(authorsHtml.includes(name), "Missing author " + name);
console.log(
  "Export passed: " +
    routes.length +
    " routes; local links, assets, chapter figures and three authors verified.",
);
