import Link from "next/link";
export default function NotFound() {
  return <main id="main-content" className="subpage wrap">
    <p className="eyebrow">404</p>
    <h1 className="page-heading">Страница не найдена</h1>
    <p className="page-intro">Выберите раздел книги или вернитесь на главную.</p>
    <div className="read-actions"><Link href="/contents/" className="button">Открыть содержание ↗</Link><Link href="/" className="button secondary">На главную</Link></div>
  </main>;
}
