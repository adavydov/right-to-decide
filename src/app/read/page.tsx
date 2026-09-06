import Link from "next/link";
import Image from "next/image";
import { ContinueReading } from "@/components/ContinueReading";
import { book, readingChapters } from "@/lib/book";
import { assetPath, siteConfig } from "@/lib/site-config";

export const metadata = {
  title: "Читать книгу",
  alternates: { canonical: siteConfig.publicUrl + "/read/" },
};

export default function ReadIndex() {
  return (
    <main id="main-content" className="subpage wrap">
      <div className="read-entrance">
        <div>
          <p className="eyebrow">Читать книгу</p>
          <h1 className="page-heading">{siteConfig.title}</h1>
          <p className="page-intro">{siteConfig.subtitle}</p>
          <div className="read-actions">
            <Link className="button" href="/read/prologue/">Начать с пролога ↗</Link>
            <Link className="button secondary" href="/contents/">Выбрать главу</Link>
          </div>
          {book.downloads && (
            <section aria-label="Скачать всю книгу">
              <p>Вся книга · редакция {book.editionVersion}</p>
              <div className="read-actions">
                <a className="button secondary" href={assetPath(book.downloads.docx.path)} download>Скачать Word ↓</a>
                <a className="button secondary" href={assetPath(book.downloads.pdf.path)} download>Скачать PDF ↓</a>
              </div>
            </section>
          )}
          <ContinueReading
            allowLegacy={false}
            revision={book.source.sha256}
            revisions={Object.fromEntries(readingChapters.map(c => [c.id, c.source?.sha256 ?? book.source.sha256]))}
            validIds={readingChapters.filter(c => c.status === "available").map(c => c.id)}
          />
        </div>
        <Image
          src={assetPath(siteConfig.coverPath)}
          alt={"Обложка книги «" + siteConfig.title + "»"}
          width={siteConfig.coverWidth}
          height={siteConfig.coverHeight}
          priority
          className="entrance-cover"
        />
      </div>
    </main>
  );
}
