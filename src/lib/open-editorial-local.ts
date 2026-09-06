import { assetPath } from "./site-config";
import type { EditorialTarget, EditorialCorpus, EditorialEdition, EditorialChapter, EditorialBlock, EditorialNote } from "./open-editorial";
export type { EditorialTarget, EditorialCorpus, EditorialEdition, EditorialChapter, EditorialBlock, EditorialNote } from "./open-editorial";
export { localDraftMarkdown, localDraftJson, validateLocalDraftTarget } from "../../shared/open-editorial-draft.mjs";

export type LocalEditorialDraft = {
  draft_schema_version: "1.0";
  state: "local_draft";
  created_at: string;
  target: EditorialTarget;
  edition_title: string;
  chapter_title?: string;
  canonical_url?: string;
  quote?: string;
  kind: string;
  message: string;
  title?: string;
  proposed_text?: string;
  sources?: { url: string; locator?: string }[];
  origin: { mode: "human" | "ai_assisted"; assistance_note?: string };
};
export function downloadLocalEditorialFile(content: string, filename: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  try {
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

export const editorialKinds: Record<string, string> = { question: "Неясно", objection: "Возражение", suggestion: "Предложение", correction: "Исправление", source: "Источник" };
export function editorialDate(value?: string) { return value ? new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" }) : ""; }
export function safeEditorialUrl(value?: string) { if (!value) return undefined; try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? value : undefined; } catch { return value.startsWith("/") && !value.startsWith("//") ? value : undefined; } }

export async function loadEditorialCorpus(): Promise<EditorialCorpus> { const response = await fetch(assetPath("/editorial/corpus.json")); if (!response.ok) throw new Error("Индекс опубликованной книги пока недоступен."); return response.json(); }
export function editorialBlockTarget(bookId: string, edition: EditorialEdition, chapter: EditorialChapter, block: EditorialBlock): EditorialTarget { return { scope: "block", book_id: bookId, edition_id: edition.id, chapter_id: chapter.id, block_id: block.id, block_snapshot_sha256: block.snapshot_sha256, normalization: "oe-text-v1" }; }
const privateNotesKey = "right-to-decide:open-editorial:browser-notes:v1";
export function readBrowserNotes(): EditorialNote[] { try { const value: unknown = JSON.parse(localStorage.getItem(privateNotesKey) || "[]"); return Array.isArray(value) ? value.filter((note): note is EditorialNote => Boolean(note && typeof note.id === "string" && typeof note.message === "string" && note.target?.edition_id)) : []; } catch { return []; } }
export function saveBrowserNotes(notes: EditorialNote[]) { localStorage.setItem(privateNotesKey, JSON.stringify(notes)); window.dispatchEvent(new Event("editorial-notes")); }
