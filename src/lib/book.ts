import bookData from "@/data/book.json";
import previousEditionData from "@/data/previous-edition.json";
import authorsData from "@/data/authors.json";

export type BookList = {
  kind: "ordered" | "unordered";
  level: number;
  marker: string;
  sourceNumberId: string;
};

export type TextRun = {
  text: string;
  href?: string;
  emphasis?: boolean;
  strong?: boolean;
  code?: boolean;
  noteId?: string;
};

export type TextBlock = {
  type: "paragraph" | "heading";
  id: string;
  text: string;
  level?: number;
  role?: "quote" | "caption" | "separator";
  list?: BookList;
  math?: { text: string; omml: string }[];
  runs?: TextRun[];
};

export type TableBlock = {
  type: "table";
  id: string;
  rows: string[][];
  cellRuns?: TextRun[][][];
  cellLayout: { colSpan: number; verticalMerge: "restart" | "continue" | null }[][];
};

export type ImageBlock = {
  type: "image";
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export type BookBlock = TextBlock | TableBlock | ImageBlock;

export type BookChapter = {
  outlineTitle?: string;
  contentKind?: "outline" | "manuscript";
  id: string;
  number: number | string | null;
  title: string;
  part: string | null;
  kind: "frontmatter" | "chapter" | "appendix" | "backmatter";
  status: "available" | "planned";
  publicationStatus: "draft" | "published";
  blocks: BookBlock[];
  version?: string;
  summary?: string;
  notesHeading?: string;
  editorialStatus?: string;
  source?: { path: string; sha256: string };
  sourceFile?: string;
  sourceSha256?: string;
  download?: { docx: string; sha256: string; bytes: number };
};

export type BookDownload = { path: string; sha256: string; bytes: number };

export type Book = {
  downloads?: { docx: BookDownload; pdf: BookDownload };
  contentKind?: "outline" | "manuscript";
  version?: string;
  editionVersion?: string;
  schemaVersion: number;
  title: string;
  subtitle: string;
  edition: string;
  publicationStatus: "draft" | "published";
  source: {
    filename: string;
    path?: string;
    format: string;
    sha256: string;
    importer: string;
    textPolicy: string;
  };
  parts: { id: string; number: string; title: string; description?: string[] }[];
  chapters: BookChapter[];
  notes: { id: string; kind: "footnote" | "endnote"; blocks: BookBlock[]; chapterId?: string; number?: number | string; sourceId?: string }[];
  statistics: Record<string, number | string>;
};

/** User-approved author updates shared by the cards and reader.
 * Keep the imported DOCX snapshot intact; preserve reader block anchors.
 */
const authorTextByBlockId = new Map(
  authorsData.authors.map((author) => [
    "body-" + author.manuscriptParagraph.slice(1),
    author.name + " — " + author.bio.charAt(0).toLocaleLowerCase("ru") + author.bio.slice(1),
  ]),
);
authorTextByBlockId.set(
  "body-0006",
  "Авторы: " + authorsData.authors.map((author) =>
    author.publicationName + " (" + author.affiliation + ")"
  ).join("; ") + ".",
);

/** Render text as text, never raw HTML/OMML. */
export const book: Book = {
  ...(bookData as Book),
  chapters: (bookData as Book).chapters.map((chapter) => ({
    ...chapter,
    blocks: chapter.blocks.map((block) => {
      const text = bookData.source.format === "docx" ? authorTextByBlockId.get(block.id) : undefined;
      return block.type === "paragraph" && text ? { ...block, text } : block;
    }),
  })),
};
export const chapters = book.chapters;
export const previousEdition = previousEditionData as Book;
export const archiveChapters = previousEdition.chapters.filter(c => c.id !== "source-contents" && c.status === "available");
export const mainChapters = chapters.filter((chapter) => chapter.kind === "chapter");
export const publishedChapterCount = mainChapters.filter((chapter) => chapter.status === "available").length;
export const publicationSummary = publishedChapterCount === 0
  ? "Опубликованы авторский пролог и развёрнутое содержание. Главы готовятся к публикации."
  : `Опубликованы пролог и главы: ${publishedChapterCount} из ${mainChapters.length}${chapters.some(c => c.id === "epilogue" && c.status === "available") ? ", а также эпилог" : ""}.`;
export const appendices = chapters.filter((chapter) => chapter.kind === "appendix");
/** Retain the DOCX page index in source data; use chapter links for web navigation. */
export const readingChapters = chapters.filter((chapter) => chapter.id !== "source-contents");

export function getChapter(id: string): BookChapter | undefined {
  return chapters.find((chapter) => chapter.id === id);
}

export function getBlockText(block: BookBlock): string {
  if (block.type === "table") return block.rows.map((row) => row.join("\t")).join("\n");
  if (block.type === "image") return "";
  return (block.list ? block.list.marker + " " : "") + block.text;
}

export function getChapterText(chapter: BookChapter): string {
  return chapter.blocks.map(getBlockText).filter(Boolean).join("\n\n");
}

export function getChapterReadingMinutes(chapter: BookChapter): number {
  if (chapter.status !== "available") return 0;
  const words = getChapterText(chapter).match(/\S+/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(words / 180));
}

export function getChapterNeighbors(id: string) {
  const available = readingChapters.filter((chapter) => chapter.status === "available");
  const index = available.findIndex((chapter) => chapter.id === id);
  return {
    previous: index > 0 ? available[index - 1] : undefined,
    next: index >= 0 ? available[index + 1] : undefined,
  };
}
