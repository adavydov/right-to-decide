import { verifyV10Transition } from "./open-editorial-v10.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { extractLayerRegistry } from "../shared/open-editorial-layers.mjs";
import { siteConfig } from "../src/lib/site-config.ts";
import { normalizeText, NORMALIZATION } from "../shared/open-editorial-text.mjs";
import { assertEditionId, EDITION_PATTERN, verifyTransition } from "./open-editorial-identity-transition.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checking = process.argv.includes("--check");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");
const json = relative => JSON.parse(read(relative));
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const encode = value => JSON.stringify(value, null, 2) + "\n";
const output = (relative, value, immutable = false) => {
  const file = path.join(root, relative), bytes = typeof value === "string" ? value : encode(value);
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (checking) { if (old !== bytes) throw new Error("Generated artifact differs: " + relative); return; }
  if (immutable && old !== null && old !== bytes) throw new Error("Immutable published snapshot changed: " + relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
};
const manifestoPath = "docs/open-editorial/OPEN_EDITORIAL_MANIFESTO.md";
const manifestoBytes = fs.readFileSync(path.join(root, manifestoPath));
if (hash(manifestoBytes) !== "9e29567a9908bf858a6f3c09a2c5c0c3e2518ab05c17de2307d6c0e311cc7583")
  throw new Error("Manifesto changed: a new reviewed version and provenance entry are required.");
const constitutionFile=path.join(root,"CONSTITUTION.md");
const constitution=fs.existsSync(constitutionFile)?read("CONSTITUTION.md"):"";
const layers=extractLayerRegistry(constitution,fs.existsSync(constitutionFile)?hash(fs.readFileSync(constitutionFile)):null);
const book = json("src/data/book.json");
if (book.publicationStatus !== "published" || book.source.format !== "markdown-manuscript")
  throw new Error("Only the published Markdown manuscript renderer has been verified.");
const editionId = book.releaseId || "edition-" + book.editionVersion + "-" + book.source.sha256.slice(0, 12);
assertEditionId(editionId);
const site = siteConfig.publicUrl;
const base = site + "/editorial/editions/" + editionId;
const mapPath = "docs/open-editorial/block-identities.json";
const identityBytes = fs.existsSync(path.join(root, mapPath)) ? fs.readFileSync(path.join(root, mapPath)) : Buffer.from(encode({ schema_version: "1.0", chapters: {} }));
const identities = book.editionVersion === "10.0" ? verifyV10Transition(root, book) : verifyTransition(root, book, identityBytes);
const seen = new Set();
const chapters = book.chapters.filter(c => c.status === "available" && c.publicationStatus === "published" && c.id !== "source-contents").map(c => {
  const source = c.source?.sha256 ?? c.sourceSha256;
  const previous = identities.chapters[c.id];
  if (previous && previous.source_sha256 !== source)
    throw new Error("Changed chapter requires an explicit reviewed identity mapping before import: " + c.id);
  const sourceBlocks = [...c.blocks, ...book.notes.filter(n => n.chapterId === c.id).flatMap(n => n.blocks)];
  const blocks = sourceBlocks.map(b => {
    if (seen.has(b.id)) throw new Error("Duplicate block identity: " + b.id);
    seen.add(b.id);
    const text = normalizeText(b.type === "image" ? b.alt || "" : b.type === "table" ? b.rows.map(r => r.join("\t")).join("\n") : b.runs?.length ? b.runs.map(r => r.text).join("") : b.text);
    const stableId = previous?.blocks?.[b.id] ?? b.id;
    return { id: stableId, dom_id: b.id, chapter_id: c.id, type: b.type, text,
      normalization: NORMALIZATION, snapshot_sha256: hash(NORMALIZATION + "\0" + text),
      canonical_url: base + "/" + c.id + ".html#" + stableId,
      reader_url: site + "/read/" + c.id + "/#" + b.id,
      selection_supported: ["paragraph", "heading"].includes(b.type) && !b.list && !b.math?.length };
  });
  identities.chapters[c.id] = { source_sha256: source, blocks: Object.fromEntries(blocks.map(b => [b.dom_id, b.id])) };
  const text = blocks.map(b => b.text).join("\n\n");
  const chapter = { id: c.id, title: c.title, version: c.version, source_sha256: source,
    canonical_url: base + "/" + c.id + ".html", reader_url: site + "/read/" + c.id + "/",
    json_url: base + "/" + c.id + ".json", markdown_url: base + "/" + c.id + ".md",
    text_url: base + "/" + c.id + ".txt", normalization: NORMALIZATION, markdown: "# " + c.title + "\n\n" + text + "\n", blocks };
  return chapter;
});
const edition = { id: editionId, title: book.title + " · редакция " + book.editionVersion,
  published_at: book.edition, date_precision: "day", canonical_url: base + "/index.html",
  content_manifest_sha256: hash(JSON.stringify(chapters.map(c => ({ id: c.id, source_sha256: c.source_sha256, blocks: c.blocks.map(b => ({ id: b.id, snapshot_sha256: b.snapshot_sha256 })) })))),
  source_manifest_sha256: book.source.sha256, chapters };
const editionsDir = path.join(root, "public/editorial/editions");
const previousEditions = fs.existsSync(editionsDir) ? fs.readdirSync(editionsDir).filter(id => id !== editionId)
  .map(id => path.join(editionsDir, id, "edition.json")).filter(f => fs.existsSync(f)).map(f => JSON.parse(fs.readFileSync(f, "utf8"))) : [];
const corpus = { schema_version: "1.0", book_id: "right-to-decide", current_edition_id: editionId,
  manifesto: { version: "1.0", sha256: hash(manifestoBytes), canonical_url: site + "/open-editorial/manifesto/" },
  layers, editions: [...previousEditions, edition] };
const escape = text => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const page = (title, content) => '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escape(title) + '</title><style>body{max-width:76ch;margin:3rem auto;padding:0 1rem;background:#f4f1eb;color:#20231e;font:1.15rem/1.7 system-ui}a{color:#275441}section{white-space:pre-wrap;margin:1.5rem 0}a:focus-visible{outline:3px solid}</style><body><nav><a href="' + site + '/open-editorial/">Открытая редакция</a></nav><main><h1>' + escape(title) + '</h1>' + content + "</main></body></html>\n";
for (const c of chapters) {
  const prefix = "public/editorial/editions/" + editionId + "/" + c.id;
  output(prefix + ".json", c, true); output(prefix + ".md", c.markdown, true);
  output(prefix + ".txt", c.blocks.map(b => b.text).join("\n\n") + "\n", true);
  output(prefix + ".html", page(c.title, "<p>Исходный опубликованный снимок · " + escape(book.edition) + " · " + escape(editionId) + "</p>" + c.blocks.map(b => '<section id="' + escape(b.id) + '">' + escape(b.text) + "</section>").join("\n")), true);
}
output("public/editorial/editions/" + editionId + "/edition.json", edition, true);
output("public/editorial/editions/" + editionId + "/index.html", page(edition.title, "<p>Снимок сохраняет исходный текст и не меняется при следующем выпуске.</p><ol>" + chapters.map(c => '<li><a href="' + escape(c.canonical_url) + '">' + escape(c.title) + "</a></li>").join("") + "</ol>"), true);
output(mapPath, identities);
output("public/editorial/corpus.json", corpus);
output("public/editorial/layers.json", layers);
output("public/editorial/manifesto.md", manifestoBytes.toString("utf8"));
output("public/editorial/manifesto-meta.json", corpus.manifesto);
console.log(JSON.stringify({ mode: checking ? "verified" : "generated", edition_id: editionId, editions: corpus.editions.length, chapters: chapters.length, blocks: seen.size, layers: layers.items.length, manifesto_sha256: hash(manifestoBytes) }));


const connectedMode = process.env.NEXT_PUBLIC_EDITORIAL_MODE === "connected";
const configuredApi = connectedMode ? (process.env.NEXT_PUBLIC_EDITORIAL_API_URL || "").replace(/\/$/, "") : "";
if (configuredApi) {
  const url = new URL(configuredApi);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Unsafe public API URL.");
}
const discovery = {
  schema_version: "1.0", name: "Открытая редакция будущего", mode: connectedMode ? "connected" : "static", api_root: configuredApi || null,
  configuration_status: connectedMode ? (configuredApi ? "probe_live_meta" : "not_configured") : "static",
  openapi_url: site + "/open-editorial/openapi.json", guide_url: site + "/open-editorial/agents/guide.md",
  manifesto_url: site + "/open-editorial/manifesto/", manifesto_version: "1.0", manifesto_sha256: hash(manifestoBytes),
  corpus_url: site + "/editorial/corpus.json", capability_authority: configuredApi ? configuredApi + "/meta" : null,
  auth: { public_read: "none", submission: configuredApi ? "owner-issued-scoped-bearer" : null, registration_url: configuredApi ? site + "/open-editorial/me/" : null },
  capabilities: { read_published_text: true, prepare_local_draft: !connectedMode, submit_contribution: false, read_own_receipt: false, write_book: false, editorial_decisions: false, read_private_notes: false },
  layer_registry: { expected_active_count: 9, status: layers.registry_status, url: site + "/editorial/layers.json" }
};
output("public/open-editorial/agent-manifest.json", discovery);
output("public/open-editorial/agents/guide.md", read(connectedMode ? "docs/open-editorial/AGENT_GUIDE.md" : "docs/open-editorial/STATIC_AGENT_GUIDE.md"));
if (connectedMode) {
  const openapiPath = path.join(root, "open-editorial-service/openapi.json");
  if (fs.existsSync(openapiPath)) output("public/open-editorial/openapi.json", read("open-editorial-service/openapi.json"));
} else {
  const operation = (summary, mediaType, parameters = []) => ({ get: { summary, ...(parameters.length ? { parameters } : {}), responses: { "200": { description: "Published static file", content: { [mediaType]: { schema: mediaType === "application/json" ? { type: "object" } : { type: "string" } } } }, "404": { description: "Published file not found" } } } });
  const parameter = name => ({ name, in: "path", required: true, schema: { type: "string", pattern: name === "edition_id" ? EDITION_PATTERN : "^[a-zA-Z0-9-]+$" } });
  const paths = {
    "/editorial/corpus.json": operation("Опубликованный корпус и версии", "application/json"),
    "/editorial/layers.json": operation("Реестр девяти слоёв", "application/json"),
    "/editorial/manifesto.md": operation("Дословный манифест участия", "text/markdown"),
    "/editorial/editions/{edition_id}/edition.json": operation("Неизменяемая редакция", "application/json", [parameter("edition_id")])
  };
  for (const [extension, media] of [["json", "application/json"], ["md", "text/markdown"], ["txt", "text/plain"], ["html", "text/html"]]) {
    paths["/editorial/editions/{edition_id}/{chapter_id}." + extension] = operation("Опубликованный снимок главы: " + extension, media, [parameter("edition_id"), parameter("chapter_id")]);
  }
  output("public/open-editorial/openapi.json", { openapi: "3.1.1", info: { title: "Открытая редакция: чтение опубликованных файлов", version: "1.0.0", description: "Статический выпуск. Доступно только чтение опубликованных файлов. Отправки материалов, аккаунтов, ключей и квитанций здесь нет." }, servers: [{ url: site }], paths });
}
