/** oe-text-v1 accepts decoded source text, never HTML or reader controls. */
export const NORMALIZATION = "oe-text-v1";
export function normalizeText(text) {
  if (typeof text !== "string") throw new TypeError("Expected decoded text");
  return text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").normalize("NFC");
}
function invalid(code) { const error = new Error(code); error.code = code; throw error; }
/** Positions use Unicode code points; a selector cannot split a grapheme cluster. */
export function resolveSelector(text, selector) {
  const canonical = normalizeText(text), points = Array.from(canonical);
  if (!selector || selector.type !== "TextQuoteSelector" || typeof selector.exact !== "string" || !selector.exact.length) invalid("INVALID_TARGET");
  const exact = normalizeText(selector.exact);
  if (exact !== selector.exact) invalid("TARGET_QUOTE_MISMATCH");
  const prefix = selector.prefix ?? "", suffix = selector.suffix ?? "";
  if (typeof prefix !== "string" || typeof suffix !== "string") invalid("INVALID_TARGET");
  const boundaries = new Set([0, points.length]);
  let offset = 0;
  for (const { segment } of new Intl.Segmenter("und", { granularity: "grapheme" }).segment(canonical)) {
    offset += Array.from(segment).length; boundaries.add(offset);
  }
  const matches = (start, end) => boundaries.has(start) && boundaries.has(end)
    && points.slice(start, end).join("") === exact
    && points.slice(0, start).join("").endsWith(prefix)
    && points.slice(end).join("").startsWith(suffix);
  if (selector.position) {
    const { type, start, end } = selector.position;
    if (type !== "TextPositionSelector" || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > points.length) invalid("INVALID_TARGET");
    if (!boundaries.has(start) || !boundaries.has(end)) invalid("INVALID_GRAPHEME_BOUNDARY");
    if (!matches(start, end)) invalid("TARGET_QUOTE_MISMATCH");
    return { start, end };
  }
  const length = Array.from(exact).length, found = [];
  for (let start = 0; start + length <= points.length; start++) {
    if (matches(start, start + length)) found.push({ start, end: start + length });
    if (found.length > 1) invalid("AMBIGUOUS_TARGET");
  }
  if (!found.length) invalid("TARGET_QUOTE_MISMATCH");
  return found[0];
}
