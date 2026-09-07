import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const BASE = "manuscript/2026-09-06-corpus-rebuild";
const sha = value => createHash("sha256").update(value).digest("hex");
const decode = bytes => JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
const ids = ["prologue", ...Array.from({length: 18}, (_, i) => "chapter-" + String(i + 1).padStart(2, "0")), "epilogue", "appendix-d"];
const sourcePath = id => id === "appendix-d" ? "appendices/scenario-passport-v1.6.md" : (id.startsWith("chapter-") ? "chapters/" : "") + id + ".md";
const criteriaIds = ["qualityOfThought", "argumentDramaturgy", "strongContradiction", "grounding", "scenarioHonesty", "futureMechanism", "realAuthorship", "threeResults", "multipleLayers", "livingLanguage", "chapterValue", "actionability"];
function local(relative) {
  assert.ok(typeof relative === "string" && relative && !path.isAbsolute(relative) && !relative.includes("\\"), "Unsafe v9 evidence path");
  const resolved = path.resolve(relative), within = path.relative(process.cwd(), resolved);
  assert.ok(within && !within.startsWith("..") && !path.isAbsolute(within), "v9 evidence escapes repository");
  return resolved;
}
function checked(entry) {
  assert.match(entry?.sha256 || "", /^[a-f0-9]{64}$/i);
  const bytes = fs.readFileSync(local(entry.path));
  assert.equal(sha(bytes), entry.sha256.toLowerCase(), "Changed v9 evidence: " + entry.path);
  return bytes;
}
function criteria(items) {
  assert.deepEqual(items?.map(c => c.id), criteriaIds, "Ordered 12 criteria required");
  for (const item of items) {
    assert.ok(item.score === 3 || item.score === 4 || item.score === "N/A", "Applicable score below 3/4");
    assert.ok(typeof item.reason === "string" && item.reason.trim(), "Every criterion requires a reason");
  }
}
export function validateV9Projection(book, manifest) {
  assert.equal(book.editionVersion, "9.0");
  assert.equal(book.source.path, BASE + "/release-manifest.json");
  assert.equal(manifest.schemaVersion, 5);
  assert.equal(manifest.editionVersion, "9.0");
  assert.equal(manifest.includesEpilogue, true);
  assert.equal(manifest.published, true);
  assert.equal(manifest.acceptanceStatus, "independent-editorial-review");
  assert.deepEqual(book.chapters.map(c => c.id), ["prologue", "contents", ...ids.slice(1)]);
  const texts = book.chapters.filter(c => c.contentKind === "manuscript" && c.status === "available");
  assert.deepEqual(texts.map(c => c.id), ids);
  assert.deepEqual(manifest.downloads.map(d => d.id), ids);
  const appendix = texts.at(-1);
  assert.equal(appendix.kind, "appendix"); assert.equal(appendix.version, "1.6"); assert.equal(appendix.number, "Д");
  assert.deepEqual(manifest.supplements, [{id: appendix.id, version: "1.6", ...appendix.source}]);
  const baseline = decode(checked(manifest.baselineBook));
  assert.equal(baseline.releaseId, "literary-manuscript-v8.0-f3c9128893a3");
  const baselineRelease = decode(checked(manifest.baselineRelease));
  assert.equal(baselineRelease.bookSha256, manifest.baselineBook.sha256);
  const baselineById = new Map(baseline.chapters.map(c => [c.id, c]));
  const preserved = texts.filter(c => baselineById.get(c.id)?.source.sha256 === c.source.sha256);
  assert.deepEqual(manifest.preservedSources, preserved.map(c => ({id: c.id, ...baselineById.get(c.id).source})));
  for (const chapter of texts) {
    assert.equal(chapter.version, chapter.id === "appendix-d" ? "1.6" : "9.0");
    assert.equal(chapter.source.path, BASE + "/" + sourcePath(chapter.id));
    checked(chapter.source);
    const old = baselineById.get(chapter.id);
    const unchanged = old?.source.sha256 === chapter.source.sha256;
    const notes = book.notes.filter(n => n.chapterId === chapter.id);
    if (unchanged) {
      assert.deepEqual(chapter.blocks, old.blocks, "Preserved block projection changed");
      assert.deepEqual(notes, baseline.notes.filter(n => n.chapterId === chapter.id), "Preserved notes changed");
    } else {
      for (const block of [...chapter.blocks, ...notes.flatMap(n => n.blocks)])
        assert.ok(block.id.startsWith("manuscript-v9-" + chapter.id + "-"), "Wrong v9 block identity");
    }
  }
  const acceptance = decode(checked(manifest.acceptance));
  assert.equal(manifest.acceptance.path, BASE + "/acceptance-v9.json");
  assert.equal(acceptance.schemaVersion, 1); assert.equal(acceptance.edition, "9.0");
  assert.equal(acceptance.decision, "accepted-local-editorial-edition");
  const accepted = [...acceptance.texts, ...acceptance.supplements];
  assert.equal(acceptance.texts.length, 20); assert.equal(acceptance.supplements.length, 1);
  assert.equal(acceptance.supplements[0].id, "appendix-d");
  assert.deepEqual(accepted.map(e => e.path), ids.map(sourcePath));
  const checks = new Map(acceptance.checks.map(e => [e.path, e]));
  assert.equal(checks.size, acceptance.checks.length);
  for (const item of checks.values()) checked({...item, path: BASE + "/" + item.path});
  accepted.forEach((entry, i) => {
    assert.equal(entry.sha256.toLowerCase(), texts[i].source.sha256);
    assert.equal(entry.decision, "accepted-agent-editorial"); assert.equal(entry.unresolvedRequiredChanges, 0);
    assert.ok(entry.author && entry.independentReviewer && entry.author !== entry.independentReviewer);
    assert.ok(checks.has(entry.review) && checks.has(entry.receipt)); criteria(entry.criteria);
  });
  assert.deepEqual(manifest.reviews.map(r => r.id), ids);
  for (const review of manifest.reviews) {
    assert.ok(review.author && review.reviewer && review.author !== review.reviewer);
    checked(review);
  }
  assert.deepEqual(manifest.wholeBookReviewScope, acceptance.wholeBook);
  for (const kind of ["continuousReading", "withoutSpace", "spaceOnly", "criteria"]) {
    const review = acceptance.wholeBook[kind];
    assert.equal(review.decision, "pass"); assert.equal(review.unresolvedRequiredChanges, 0);
    assert.ok(review.author && review.independentReviewer && review.author !== review.independentReviewer);
    assert.equal(checks.get(review.path)?.sha256, review.sha256);
    checked({...review, path: BASE + "/" + review.path});
  }
  criteria(acceptance.wholeBook.criteria.criteria);
  const assembly = decode(checked(manifest.assembly));
  assert.equal(manifest.assembly.path, BASE + "/reading/assembly-v9.json");
  assert.equal(assembly.edition, "9.0"); assert.equal(assembly.published, false);
  assert.deepEqual(assembly.inputs.map(e => e.path), ids.map(sourcePath));
  assembly.inputs.forEach((entry, i) => {
    assert.equal(entry.order, i); assert.equal(entry.id, ids[i]); assert.equal(entry.edition, "9.0");
    assert.equal(entry.kind, i === 20 ? "appendix" : "literary");
    assert.equal(entry.sha256.toLowerCase(), texts[i].source.sha256);
  });
  const metadata = decode(checked(assembly.releaseMetadata));
  assert.equal(assembly.releaseMetadata.path, BASE + "/release-metadata.json");
  assert.equal(metadata.schemaVersion, 1); assert.equal(metadata.edition, "9.0");
  assert.match(metadata.releaseDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(book.edition, metadata.releaseDate); assert.equal(manifest.releaseDate, metadata.releaseDate);
  assert.equal(assembly.releaseDate, metadata.releaseDate); assert.ok(acceptance.date <= metadata.releaseDate);
  assert.deepEqual(decode(checked(assembly.supplementsSelection)).appendices, [{path: sourcePath("appendix-d"), id: "appendix-d"}]);
  const noteMap = [];
  for (const chapter of texts) for (const note of book.notes.filter(n => n.chapterId === chapter.id))
    noteMap.push({input: sourcePath(chapter.id), local: String(note.number), global: noteMap.length + 1});
  assert.deepEqual(assembly.noteMap, noteMap);
  assert.equal(book.notes.length, assembly.noteCount); assert.equal(manifest.noteCount, assembly.noteCount);
  for (const key of ["allInputHashesStable", "globalNoteDefinitionsSequential", "privatePathsAbsent", "completeVisibleTextMatchesMarkdown", "completePdfTextMatchesDocx"])
    assert.equal(assembly.checks[key], true, "Incomplete reader verification: " + key);
  assert.deepEqual(Object.keys(book.downloads).sort(), ["docx", "md", "pdf"]);
  assert.equal(manifest.readingDownloads.length, 3); assert.equal(assembly.outputs.length, 3);
  for (const format of ["md", "docx", "pdf"]) {
    const item = book.downloads[format], expectedPath = "/book/right-to-decide-v9.0." + format;
    assert.equal(item.path, expectedPath);
    const raw = checked({...item, path: "public" + item.path}); assert.equal(raw.length, item.bytes);
    if (format !== "md") assert.equal(raw.subarray(0, format === "pdf" ? 5 : 2).toString(), format === "pdf" ? "%PDF-" : "PK");
    else assert.ok(raw.toString("utf8").startsWith("# "), "Missing Markdown title");
    const output = assembly.outputs.find(e => e.name === "right-to-decide-v9.0." + format);
    assert.ok(output); assert.equal(output.sha256, item.sha256); assert.equal(output.bytes, item.bytes);
    const source = BASE + "/reading/" + output.name;
    assert.deepEqual(raw, checked({...output, path: source}));
    assert.deepEqual(manifest.readingDownloads.find(d => d.kind === format), {kind: format, ...item, sourcePath: source});
  }
}
