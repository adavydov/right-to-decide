import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const book = JSON.parse(fs.readFileSync("src/data/book.json", "utf8"));
const authors = JSON.parse(
  fs.readFileSync("src/data/authors.json", "utf8"),
).authors;
assert.equal(book.title, "Право на решение");
assert.equal(authors.length, 3);
assert.equal(
  new Set(book.chapters.map((c) => c.id)).size,
  book.chapters.length,
);
for (const c of book.chapters) {
  assert.match(c.id, /^[a-z0-9-]+$/);
  assert.ok(["available", "planned"].includes(c.status));
  if (c.status === "available") assert.ok(c.blocks.length > 0, c.id);
  for (const b of c.blocks) {
    if (b.type === "image")
      assert.ok(fs.existsSync(path.join("public", b.src)), b.src);
    else if (b.type === "table")
      assert.ok(
        b.rows.every(
          (r) =>
            Array.isArray(r) && r.every((cell) => typeof cell === "string"),
        ),
      );
    else assert.equal(typeof b.text, "string");
  }
}
for (const a of authors) {
  assert.ok(a.name && a.bio);
  if (a.photo)
    assert.ok(fs.existsSync(path.join("public", a.photo.src)), a.name);
}
assert.ok(fs.existsSync("public/images/book-cover.png"));
console.log(
  "Content passed: " +
    book.chapters.filter((c) => c.kind === "chapter").length +
    " chapters, " +
    book.chapters.filter((c) => c.kind === "appendix").length +
    " appendices, " +
    authors.length +
    " authors. All local media present.",
);
