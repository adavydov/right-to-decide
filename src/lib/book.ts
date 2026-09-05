import bookData from "@/data/book.json";
import authorsData from "@/data/authors.json";

export type BookList = {
  kind: "ordered" | "unordered";
  level: number;
  marker: string;
  sourceNumberId: string;
};

export type TextBlock = {
  type: "paragraph" | "heading";
  id: string;
  text: string;
  level?: number;
  role?: "quote" | "caption";
  list?: BookList;
  math?: { text: string; omml: string }[];
};

export type TableBlock = {
  type: "table";
  id: string;
  rows: string[][];
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
  id: string;
  number: number | string | null;
  title: string;
  part: string | null;
  kind: "frontmatter" | "chapter" | "appendix" | "backmatter";
  status: "available" | "planned";
  publicationStatus: "draft" | "published";
  blocks: BookBlock[];
};

export type Book = {
  schemaVersion: number;
  title: string;
  subtitle: string;
  edition: string;
  publicationStatus: "draft" | "published";
  source: {
    filename: string;
    format: string;
    sha256: string;
    importer: string;
    textPolicy: string;
  };
  parts: { id: string; number: string; title: string }[];
  chapters: BookChapter[];
  notes: { id: string; kind: "footnote" | "endnote"; blocks: BookBlock[] }[];
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
      const text = authorTextByBlockId.get(block.id);
      return block.type === "paragraph" && text ? { ...block, text } : block;
    }),
  })),
};
export const chapters = book.chapters;
export const mainChapters = chapters.filter((chapter) => chapter.kind === "chapter");
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
