import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { normalizeText, resolveSelector, NORMALIZATION } from "../shared/open-editorial-text.mjs";
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
test("canonical normalization preserves whitespace, Cyrillic, emoji and NFC", () => {
  assert.equal(normalizeText("Ёж\u00a0 👩‍🔬\r\nи\u0306  дом\rконец"), "Ёж  👩‍🔬\nй  дом\nконец");
  assert.equal(normalizeText("&amp; <буквальный текст>"), "&amp; <буквальный текст>");
});
test("positions are Unicode code points and cannot split a grapheme cluster", () => {
  assert.deepEqual(resolveSelector("А🚀Б", { type:"TextQuoteSelector", exact:"🚀", position:{type:"TextPositionSelector",start:1,end:2} }), {start:1,end:2});
  assert.throws(() => resolveSelector("А👩‍🔬Б", {type:"TextQuoteSelector",exact:"👩",position:{type:"TextPositionSelector",start:1,end:2}}), /INVALID_GRAPHEME_BOUNDARY/);
  assert.deepEqual(resolveSelector("А👩‍🔬Б", {type:"TextQuoteSelector",exact:"👩‍🔬",position:{type:"TextPositionSelector",start:1,end:4}}), {start:1,end:4});
});
test("ambiguous quotes need context, absent or invalid positions fail", () => {
  assert.throws(() => resolveSelector("Да. Да.",{type:"TextQuoteSelector",exact:"Да"}), /AMBIGUOUS_TARGET/);
  assert.deepEqual(resolveSelector("Да. Да.",{type:"TextQuoteSelector",exact:"Да",prefix:"Да. "}),{start:4,end:6});
  assert.throws(() => resolveSelector("Нет",{type:"TextQuoteSelector",exact:"Да"}), /TARGET_QUOTE_MISMATCH/);
  assert.throws(() => resolveSelector("Да",{type:"TextQuoteSelector",exact:"Да",position:{type:"TextPositionSelector",start:-1,end:2}}), /INVALID_TARGET/);
});
test("published corpus is faithful, excludes drafts, has unique frozen blocks and original manifesto", () => {
  const corpus = JSON.parse(fs.readFileSync(new URL("../public/editorial/corpus.json",import.meta.url)));
  const book = JSON.parse(fs.readFileSync(new URL("../src/data/book.json",import.meta.url)));
  const edition = corpus.editions.find(e => e.id === corpus.current_edition_id);
  assert.deepEqual(edition.chapters.map(c=>c.id), book.chapters.filter(c=>c.status==="available"&&c.publicationStatus==="published"&&c.id!=="source-contents").map(c=>c.id));
  const blocks = edition.chapters.flatMap(c=>c.blocks);
  assert.equal(new Set(blocks.map(b=>b.id)).size,blocks.length);
  for (const block of blocks) assert.equal(block.snapshot_sha256,hash(NORMALIZATION+"\0"+block.text));
  assert.equal(corpus.layers.items.length,9);
  assert.deepEqual(corpus.layers.items.map(l=>l.id),["С01","С02","С03","С04","С05","С06","С07","С08","С09"]);
  assert.equal(hash(fs.readFileSync(new URL("../docs/open-editorial/OPEN_EDITORIAL_MANIFESTO.md",import.meta.url))),"9e29567a9908bf858a6f3c09a2c5c0c3e2518ab05c17de2307d6c0e311cc7583");
  assert.deepEqual(fs.readFileSync(new URL("../public/editorial/manifesto.md",import.meta.url)),fs.readFileSync(new URL("../docs/open-editorial/OPEN_EDITORIAL_MANIFESTO.md",import.meta.url)));
});


test("missing or historical eight-layer source never invents a ninth or blocks unclassified intake", async () => {
 const {extractLayerRegistry}=await import("../shared/open-editorial-layers.mjs");
 const source=fs.readFileSync(new URL("../CONSTITUTION.md",import.meta.url),"utf8");
 assert.equal(extractLayerRegistry(source,"test").items.length,9);
 for(const value of ["",source.replace("### С09.","### Historical.")])assert.deepEqual(extractLayerRegistry(value,"test").items,[]);
 assert.equal(extractLayerRegistry("","test").registry_status,"unresolved");
});
