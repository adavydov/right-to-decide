import Link from "next/link";
import { PublicationHero } from "@/components/PublicationHero";
import { AuthorsGrid } from "@/components/AuthorsGrid";
import { siteConfig } from "@/lib/site-config";
import { book, mainChapters } from "@/lib/book";
import { displayBookTitle } from "@/lib/book-display";
import { cards, sources } from "@/lib/library";
import authorsData from "@/data/authors.json";

export const metadata = { alternates: { canonical: siteConfig.publicUrl + "/" } };
const pillars = [
  { title: "Ставить новые задачи", text: "Фундаментальное знание помогает пересматривать предпосылки, строить объяснения и замечать возможности, для которых ещё нет готового заказа. Как учиться этой работе рядом с более сильным интеллектом?" },
  { title: "Обоснованно доверять и действовать", text: "Качество результата, способность участника и полномочие требуют разных оснований. Как делегировать работу ИИ, проверять изменения условий и принимать ответственность за последствия?" },
  { title: "Создавать и пересматривать альтернативы", text: "Замыслу нужны ресурсы, опыт и право на первую попытку. Как образование и организации могут поддерживать людей, способных воплотить иной путь и изменить унаследованный порядок?" },
];
export default function HomePage() {
  const available = mainChapters.filter(c => c.status === "available").length;
  const structured = {
    "@context": "https://schema.org", "@type": "Book", name: siteConfig.title,
    alternateName: siteConfig.subtitle, inLanguage: "ru", isAccessibleForFree: true,
    url: siteConfig.publicUrl + "/", image: siteConfig.publicUrl + siteConfig.coverPath,
    author: authorsData.authors.map(a => ({ "@type": "Person", name: a.name })),
  };
  return <main id="main-content">
    <PublicationHero />
    <section className="publication-section wrap" id="about">
      <div className="publication-grid">
        <div><p className="eyebrow publication-kicker">О книге</p><h2 className="publication-heading">Человеческая способность должна расти вместе с возможностями ИИ</h2></div>
        <div className="publication-prose">
          <p>Искусственный интеллект меняет работу, способы исследования и представления о том, что возможно. Вместе с его возможностями должна развиваться человеческая способность создавать цели, решения и институты.</p>
          <p>Авторы исследуют, как связать развитие человека с деятельностью рядом с сильным ИИ. Фундаментальное знание, исследование и практика помогают проверять основания доверия и создавать то, чего ещё нет.</p>
          <p>Российская транспортная школа даёт этому замыслу историческую и предметную опору. Через становление инженера и устройство университета книга выходит к вопросу о том, какие люди и институты смогут определять направление общего развития.</p>
        </div>
      </div>
    </section>
    <section className="pillars">
      <div className="wrap">
        <div className="section-top"><div><p className="eyebrow">Три вопроса о человеческой самостоятельности</p><h2>Ставить задачи, действовать обоснованно, создавать иное</h2></div></div>
        <div className="pillar-grid">{pillars.map((p, i) => <article className="pillar" key={p.title}><span className="number">0{i + 1} /</span><h3>{p.title}</h3><p>{p.text}</p></article>)}</div>
      </div>
    </section>
    <section className="publication-section wrap">
      <div className="section-top"><div><p className="eyebrow">Текст книги</p><h2>Выберите вопрос,<br />с которого начать</h2></div><Link href="/contents/" className="text-link">Полное содержание ↗</Link></div>
      <div className="edition-notice"><span className="status-dot" /><p>{book.schemaVersion === 1 ? "Авторы пересматривают концепцию книги. В читалке сохранена редакция от 4 сентября 2026 года." : `Опубликованы предисловие и ${available} глав. Остальные главы готовятся.`}</p></div>
      <div className="preview-list">{book.parts.map(part => <Link className="preview-row" href={`/contents/#${part.id}`} key={part.id}><small>{part.number}</small><span>{displayBookTitle(part.title).replace(/^Часть\s+[IVXLC\d]+[.\s:—–-]*/i, "")}</span><span className="arrow" aria-hidden="true">↗</span></Link>)}</div>
      <div className="book-callout"><div><h3>Вернуться к тексту<br />со своим вопросом</h3><p>Размер текста, шрифт и тема настраиваются под вас. Читалка сохраняет место и закладки.</p></div><Link href="/read/" className="button">Читать книгу ↗</Link></div>
    </section>
    <section className="publication-section wrap">
      <div className="publication-grid">
        <div><p className="eyebrow publication-kicker">Библиотека · {sources.length} источников</p><h2 className="publication-heading">Источники, к которым можно вернуться</h2></div>
        <div className="publication-prose"><p>История инженерных школ, мемуарные свидетельства и исследования помогают рассмотреть отношения знания, практики и власти над решениями. Библиотека собирает источники для дальнейшего чтения; примечания к главам указывают места, на которые опирается рассуждение.</p><Link className="publication-link" href="/library/">Открыть библиотеку ↗</Link></div>
      </div>
    </section>
    <section className="publication-section wrap">
      <div className="publication-grid">
        <div><p className="eyebrow publication-kicker">Историческая вики · {cards.length} материалов</p><h2 className="publication-heading">Исторический опыт в деталях</h2></div>
        <div className="publication-prose"><p>Как возникает инженерная школа, что позволяет пересмотреть привычную конструкцию, где проходит граница опыта? Свидетельства из мемуаров В. Г. Грабина соединяют фрагмент источника с контекстом и вопросами, которые он помогает исследовать.</p><Link className="publication-link" href="/wiki/">Открыть вики ↗</Link></div>
      </div>
    </section>
    <AuthorsGrid compact />
    <section className="publication-section wrap"><div className="publication-grid"><h2 className="publication-heading">Где вырастут те, кто сможет изменить будущее</h2><div className="publication-prose"><p>Начните с текста или выберите вопрос в содержании. Книга рассматривает, как сегодняшние решения об ИИ, работе и образовании формируют условия выбора для следующих участников.</p><Link className="button" href="/read/">Читать книгу ↗</Link></div></div></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replaceAll("<", "\\u003c") }} />
  </main>;
}
