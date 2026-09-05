import Link from "next/link";
import { ContentsCatalog } from "@/components/ContentsCatalog";
import { readingChapters, getChapterReadingMinutes } from "@/lib/book";
import { siteConfig } from "@/lib/site-config";
export const metadata = {
  title: "Содержание",
  alternates: { canonical: siteConfig.publicUrl + "/contents/" },
};
export default function ContentsPage() {
  const items = readingChapters.map((c) => ({
    id: c.id,
    title: c.title,
    part: c.part,
    kind: c.kind,
    number: c.number,
    status: c.status,
    minutes: getChapterReadingMinutes(c),
    headings: c.blocks
      .filter((b) => b.type === "heading")
      .map((b) => ("text" in b ? b.text : "")),
  }));
  return (
    <main id="main-content" className="subpage wrap">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Карта книги</p>
          <h1 className="page-heading">Содержание</h1>
          <p className="page-intro">
            От истории инженерного доверия — к устройству образования в эпоху
            искусственного интеллекта.
          </p>
          <p className="eyebrow" style={{ marginTop: 22 }}>
            <span className="status-dot" />
            Рабочая редакция · 04.09.2026
          </p>
        </div>
        <Link href="/read/" className="button">
          Начать чтение <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <ContentsCatalog items={items} />
    </main>
  );
}
