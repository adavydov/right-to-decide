export const NORMALIZATION: "oe-text-v1";
export function normalizeText(text: string): string;
export type TextSelector = { type: "TextQuoteSelector"; exact: string; prefix?: string; suffix?: string; position?: { type: "TextPositionSelector"; start: number; end: number } };
export function resolveSelector(text: string, selector: TextSelector): { start: number; end: number };
