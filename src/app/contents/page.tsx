import { EditionChoice } from "@/components/EditionChoice";
import Link from "next/link";
import { contents } from "@/data/site-copy.json";
import { ContentsCatalog } from "@/components/ContentsCatalog";
import { book, readingChapters, publicationSummary, getChapterReadingMinutes } from "@/lib/book";
import { assetPath, siteConfig } from "@/lib/site-config";

export const metadata = {
  title: "Развёрнутое содержание",
  alternates: { canonical: siteConfig.publicUrl + "/contents/" },
};

export default function ContentsPage() {
  const items = readingChapters.filter(chapter => chapter.id !== "contents").map(chapter => ({
    id: chapter.id, title: chapter.outlineTitle || chapter.title, part: chapter.part,
    kind: chapter.kind, number: chapter.number, status: chapter.status, summary: chapter.summary,
    docx: chapter.download?.docx, minutes: getChapterReadingMinutes(chapter),
  }));
  return <main id="main-content" className="subpage wrap">
    <div className="page-heading-row">
      <div>
        <p className="eyebrow">Карта книги</p>
        <h1 className="page-heading">Развёрнутое содержание</h1>
        <p className="page-intro">{contents.intro}</p>
        <p className="page-intro" style={{ marginTop: 18 }}>{publicationSummary}</p>
        <EditionChoice />
        {book.editionVersion !== "10.0" && <p style={{ marginTop: 22 }}><a className="text-link" href={assetPath("/book/contents-v5.1.md")} download>Скачать содержание ↓</a></p>}
      </div>
      <Link href={book.editionVersion === "10.0" ? "/read/prologue/" : "/read/contents/"} className="button">Открыть в читалке ↗</Link>
    </div>
    <ContentsCatalog items={items} parts={book.parts} />
    <div className="book-callout">
      <div><h3>Мир меняется.<br />Кто сможет менять его дальше?</h3><p>Начните с пролога — о прогрессе, который не обещает каждому место в будущем.</p></div>
      <Link className="button" href="/read/prologue/">Читать пролог ↗</Link>
    </div>
  </main>;
}
