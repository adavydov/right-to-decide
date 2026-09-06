import { NORMALIZATION, resolveSelector } from "./open-editorial-text.mjs";

const kindTitles = { question: "Неясно", objection: "Возражение", suggestion: "Предложение", correction: "Исправление", source: "Источник" };
const allowedKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));

/** Validate an original target against the static, published canonical corpus. */
export function validateLocalDraftTarget(target, corpus) {
  const invalid = error => ({ valid: false, error });
  if (!target || !corpus || target.book_id !== corpus.book_id) return invalid("BOOK_MISMATCH");
  const edition = corpus.editions?.find(value => value.id === target.edition_id);
  if (!edition) return invalid("EDITION_NOT_FOUND");
  const baseKeys = ["scope", "book_id", "edition_id"];
  if (target.scope === "book") return allowedKeys(target, baseKeys) ? { valid: true, edition } : invalid("INVALID_TARGET_FIELDS");
  if (!["chapter", "block"].includes(target.scope)) return invalid("INVALID_TARGET_SCOPE");
  const chapter = edition.chapters?.find(value => value.id === target.chapter_id);
  if (!chapter) return invalid("CHAPTER_NOT_FOUND");
  if (target.scope === "chapter") return allowedKeys(target, [...baseKeys, "chapter_id"]) ? { valid: true, edition, chapter } : invalid("INVALID_TARGET_FIELDS");
  if (!allowedKeys(target, [...baseKeys, "chapter_id", "block_id", "block_snapshot_sha256", "normalization", "selector"])) return invalid("INVALID_TARGET_FIELDS");
  const block = chapter.blocks?.find(value => value.id === target.block_id);
  if (!block) return invalid("BLOCK_NOT_FOUND");
  if (target.normalization !== NORMALIZATION || block.normalization !== NORMALIZATION || target.block_snapshot_sha256 !== block.snapshot_sha256 || !/^[a-f0-9]{64}$/.test(block.snapshot_sha256)) return invalid("SNAPSHOT_MISMATCH");
  if (target.selector) {
    if (block.selection_supported === false) return invalid("SELECTION_UNSUPPORTED");
    if (!allowedKeys(target.selector, ["type", "exact", "prefix", "suffix", "position"])) return invalid("INVALID_SELECTOR_FIELDS");
    if (target.selector.position && !allowedKeys(target.selector.position, ["type", "start", "end"])) return invalid("INVALID_SELECTOR_FIELDS");
    try { resolveSelector(block.text, target.selector); } catch (error) { return invalid(error.code || "QUOTE_MISMATCH"); }
  }
  return { valid: true, edition, chapter, block };
}

function targetFields(target) {
  return Object.fromEntries(["scope", "book_id", "edition_id", "chapter_id", "block_id", "block_snapshot_sha256", "normalization"].filter(key => target[key] !== undefined).map(key => [key, target[key]]).concat(
    target.selector ? [["selector", Object.fromEntries(["type", "exact", "prefix", "suffix"].filter(key => target.selector[key] !== undefined).map(key => [key, target.selector[key]]).concat(target.selector.position ? [["position", { type: target.selector.position.type, start: target.selector.position.start, end: target.selector.position.end }]] : []))]] : []
  ));
}
/** Explicit projection: credentials, consent receipts and server statuses cannot enter an exported draft. */
export function localDraftJson(draft) {
  const output = {
    draft_schema_version: "1.0", state: "local_draft", created_at: draft.created_at,
    target: targetFields(draft.target), edition_title: draft.edition_title,
    ...Object.fromEntries(["chapter_title", "canonical_url", "quote", "title", "proposed_text"].filter(key => draft[key] !== undefined).map(key => [key, draft[key]])),
    kind: draft.kind, message: draft.message,
    ...(draft.sources?.length ? { sources: draft.sources.map(source => ({ url: source.url, ...(source.locator ? { locator: source.locator } : {}) })) } : {}),
    origin: { mode: draft.origin.mode, ...(draft.origin.assistance_note ? { assistance_note: draft.origin.assistance_note } : {}) }
  };
  return JSON.stringify(output, null, 2);
}
export function localDraftMarkdown(draft) {
  const lines = [
    "# " + (draft.title || kindTitles[draft.kind] || "Замечание к книге"), "",
    "**Личный черновик. Не отправлен в редакцию и не опубликован.**", "",
    "Книга: «Право на решение»", "Редакция: " + draft.edition_title + " (" + draft.target.edition_id + ")",
    "Область: " + (draft.chapter_title || "Книга целиком"),
    ...(draft.target.block_id ? ["Блок: " + draft.target.block_id, "SHA-256 блока: " + draft.target.block_snapshot_sha256] : []),
    ...(draft.canonical_url ? ["Исходный текст: " + draft.canonical_url] : []),
    "Тип: " + (kindTitles[draft.kind] || draft.kind),
    "Происхождение: " + (draft.origin.mode === "ai_assisted" ? "С помощью ИИ" : "Самостоятельно"),
    ...(draft.origin.assistance_note ? ["Помощь ИИ: " + draft.origin.assistance_note] : []), "",
    ...(draft.quote ? ["## Фрагмент", "", ...draft.quote.split("\n").map(line => "> " + line), ""] : []),
    "## Замечание", "", draft.message, "",
    ...(draft.proposed_text ? ["## Предлагаемый вариант", "", draft.proposed_text, ""] : []),
    ...(draft.sources?.length ? ["## Источники", "", ...draft.sources.flatMap(source => [source.url, ...(source.locator ? [source.locator] : []), ""])] : []),
    "Скопировано или скачано по личному действию автора черновика. Передача в редакцию, согласие на публикацию и обработку этим файлом не подтверждаются.", ""
  ];
  return lines.join("\n");
}
