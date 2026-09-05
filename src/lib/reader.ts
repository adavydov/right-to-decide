export type ReaderSettings = {
  theme: "light" | "sepia" | "dark";
  font: "serif" | "sans";
  size: number;
  spacing: number;
  width: "narrow" | "normal" | "wide";
};
export const defaultReaderSettings: ReaderSettings = { theme: "light", font: "serif", size: 20, spacing: 1.8, width: "normal" };
export type ReadingLocation = { blockId: string; offset: number; progress: number; revision: string };
export type ReaderBookmark = ReadingLocation & { id: string; chapterId: string; title: string; excerpt: string };
export type ReaderHeading = { id: string; title: string };
export type ReaderSearchResult = { id: string; excerpt: string };
export type ReaderPanel = "contents" | "search" | "settings" | "bookmarks";
export function parseSettings(raw: string | null, legacySize: string | null): ReaderSettings {
  let saved: Partial<ReaderSettings> = {};
  try { saved = JSON.parse(raw || "{}") || {}; } catch {}
  const size = Number(saved.size ?? legacySize);
  return {
    theme: ["light", "sepia", "dark"].includes(saved.theme || "") ? saved.theme! : "light",
    font: saved.font === "sans" ? "sans" : "serif",
    size: Number.isFinite(size) && size >= 16 && size <= 28 ? size : 20,
    spacing: [1.5, 1.8, 2.1].includes(Number(saved.spacing)) ? Number(saved.spacing) : 1.8,
    width: ["narrow", "normal", "wide"].includes(saved.width || "") ? saved.width! : "normal",
  };
}
export function parseLocation(raw: string | null): ReadingLocation | null {
  try {
    const v = JSON.parse(raw || "null");
    if (v && typeof v.blockId === "string" && typeof v.revision === "string" && Number.isFinite(v.offset) && Number.isFinite(v.progress))
      return { blockId: v.blockId, revision: v.revision, offset: Math.max(0, Math.min(1, v.offset)), progress: Math.max(0, Math.min(1, v.progress)) };
  } catch {}
  return null;
}
export function parseBookmarks(raw: string | null): ReaderBookmark[] {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is ReaderBookmark => Boolean(v && typeof v.id === "string" && typeof v.chapterId === "string" && typeof v.title === "string" && typeof v.excerpt === "string" && parseLocation(JSON.stringify(v)))).slice(0, 200);
  } catch { return []; }
}
