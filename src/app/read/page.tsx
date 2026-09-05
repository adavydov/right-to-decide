import Link from "next/link";
import Image from "next/image";
import { ContinueReading } from "@/components/ContinueReading";
import { book, mainChapters, readingChapters } from "@/lib/book";
import { assetPath, siteConfig } from "@/lib/site-config";
export const metadata = { title: "Читать книгу", alternates: { canonical: siteConfig.publicUrl + "/read/" } };
export default function ReadIndex() {
  const first = readingChapters.find(c => c.id === "preface" && c.status === "available") || readingChapters.find(c => c.id === "introduction" && c.status === "available") || readingChapters.find(c => c.kind === "chapter" && c.status === "available");
  const available = mainChapters.filter(c => c.status === "available").length;
  const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(book.edition));
  return <main id="main-content" className="subpage wrap"><div className="read-entrance"><div>
    <p className="eyebrow">Открытая книга</p><h1 className="page-heading">Начать чтение</h1>
    <p className="page-intro">{book.schemaVersion === 1 ? "В читалке сохранена редакция от 4 сентября 2026 года. Авторы пересматривают концепцию и готовят новый текст." : "Начните с предисловия или выберите главу. Текст будет дополняться по мере работы авторов."}</p>
    <p className="page-intro" style={{ marginTop: 22 }}>Сейчас доступны {available} глав. Настройте шрифт и тему; место чтения и закладки сохраняются в вашем браузере.</p>
    <div className="read-actions">{first && <Link className="button" href={`/read/${first.id}/`}>{first.id === "preface" ? "Читать предисловие" : "Читать введение"} ↗</Link>}<Link className="button secondary" href="/contents/">Выбрать главу</Link></div>
    <p className="eyebrow" style={{ marginTop: 28 }}>Рабочая редакция · {date}</p>
    <ContinueReading allowLegacy={book.schemaVersion === 1} revision={book.source.sha256} validIds={readingChapters.filter(c => c.status === "available").map(c => c.id)} />
    </div><Image src={assetPath(siteConfig.coverPath)} alt="Обложка книги «Право на решение»" width={siteConfig.coverWidth} height={siteConfig.coverHeight} priority className="entrance-cover" /></div></main>;
}
