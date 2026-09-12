import Link from "next/link";
import archive from "@/data/edition-v9.json";
import { EditionChoice } from "@/components/EditionChoice";
import { assetPath } from "@/lib/site-config";
export const metadata = { title: "Редакция 9.0 · архив", robots: { index: false, follow: true } };
export default function EditionNine() {
  return <main id="main-content" className="subpage wrap"><p className="eyebrow">История книги</p><h1 className="page-heading">Редакция 9.0</h1>
    <p className="page-intro">Полный текст от 7 сентября 2026 года. Здесь открываются исходные главы и связанные с ними личные заметки.</p><EditionChoice archived />
    <p style={{ display: "flex", gap: 24, flexWrap: "wrap", margin: "24px 0" }}>{Object.entries(archive.downloads).map(([kind, file]) => <a className="text-link" key={kind} href={assetPath(file.path)} download>Скачать {kind.toUpperCase()} ↓</a>)}</p>
    <div className="preview-list">{archive.chapters.filter(c => c.status === "available").map(c => <Link className="preview-row" href={"/editions/v9/read/" + c.id + "/"} key={c.id}><small>{c.number ?? "—"}</small><span>{c.title}</span><span aria-hidden="true">↗</span></Link>)}</div>
  </main>;
}
