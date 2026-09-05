import Image from "next/image";
import Link from "next/link";
import { AudienceSection } from "@/components/AudienceSection";
import { AuthorsGrid } from "@/components/AuthorsGrid";
import { assetPath, siteConfig } from "@/lib/site-config";
import { chapters } from "@/lib/book";
import { displayBookTitle } from "@/lib/book-display";
import authorsData from "@/data/authors.json";
export const metadata = {
  alternates: { canonical: siteConfig.publicUrl + "/" },
};
const pillars = [
  {
    title: "Сформировать способность",
    text: "Как вырастить собственное инженерное суждение, когда задачи, на которых оно формировалось, выполняет ИИ.",
  },
  {
    title: "Доказать готовность",
    text: "На каком основании доверять человеку, если правильный расчёт, код или отчёт больше не доказывают понимание.",
  },
  {
    title: "Дать право действовать",
    text: "Как связать знания, полномочия и ответственность — и сохранить способность пересматривать решение.",
  },
];
export default function HomePage() {
  const firstByPart = chapters
    .filter((c) => c.kind === "chapter")
    .filter((c, i, a) => i === 0 || c.part !== a[i - 1].part);
  const structured = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: siteConfig.title,
    alternateName: siteConfig.subtitle,
    inLanguage: "ru",
    isAccessibleForFree: true,
    url: siteConfig.publicUrl + "/",
    image: siteConfig.publicUrl + "/images/book-cover-new-subtitle.png",
    author: authorsData.authors.map((a) => ({
      "@type": "Person",
      name: a.name,
    })),
  };
  return (
    <main id="main-content">
      <section className="hero wrap">
        <p className="eyebrow">
          Монография · Инженерное образование в эпоху ИИ
        </p>
        <h1>Право на решение</h1>
        <p className="lead">
          Когда ответ может дать машина,
          <br />
          на каком основании решает человек?
        </p>
        <div className="hero-actions">
          <Link href="/read/" className="button">
            Читать книгу <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/contents/" className="text-link">
            Посмотреть содержание
          </Link>
        </div>
        <p className="hero-authors">
          А. М. Давыдов · А. А. Давыдов · Е. А. Давыдов
        </p>
      </section>
      <div className="wrap">
        <div className="book-scene">
          <span className="scene-label">ПРАВО НА РЕШЕНИЕ / 2026</span>
          <div className="scene-axis" aria-hidden="true" />
          <div className="book-object">
            <Image
              src={assetPath("/images/book-cover-new-subtitle.png")}
              alt="Обложка «Право на решение»: человек перед освещённым порталом в системе инженерных связей"
              width={1024}
              height={1536}
              priority
            />
          </div>
          <span className="scene-caption">
            Способность. Доверие. Ответственность.
          </span>
          <span className="scene-number">А. М. / А. А. / Е. А.</span>
        </div>
        <div className="scene-bottom">
          <span>
            Инженерное образование как система воспроизводства
            <br />
            доверенной способности к решению
          </span>
          <span>
            Рабочая редакция
            <br />
            04 сентября 2026
          </span>
        </div>
      </div>
      <section className="intro wrap" id="about">
        <p className="eyebrow">Зачем эта книга</p>
        <div>
          <h2>
            ИИ удешевляет ответ.
            <br />
            <span>И удорожает доверие.</span>
          </h2>
          <p>
            Получить результат становится проще. Понять его границы, проверить
            основания и принять ответственность за последствия — по-прежнему
            человеческая задача.
          </p>
          <p>
            Эта монография исследует, как образование и организации могут
            воспроизводить людей, способных обоснованно принимать решения в
            мире, где всё больше работы выполняет искусственный интеллект.
          </p>
        </div>
      </section>
      <section className="pillars">
        <div className="wrap">
          <div className="section-top">
            <div>
              <p className="eyebrow">Главный вопрос</p>
              <h2>
                От правильного ответа —<br />к обоснованному решению.
              </h2>
            </div>
            <span className="eyebrow">Три связанные задачи</span>
          </div>
          <div className="pillar-grid">
            {pillars.map((p, i) => (
              <article className="pillar" key={p.title}>
                <span className="number">0{i + 1} /</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <AudienceSection />
      <section className="contents-preview wrap">
        <div className="section-top">
          <div>
            <p className="eyebrow">Внутри монографии</p>
            <h2>
              Одна проблема.
              <br />
              Шесть частей исследования.
            </h2>
          </div>
          <Link href="/contents/" className="text-link">
            Полное содержание <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="preview-list">
          {firstByPart.map((c, i) => (
            <Link
              className="preview-row"
              href={"/read/" + c.id + "/"}
              key={c.id}
            >
              <small>0{i + 1}</small>
              <span>
                {displayBookTitle(
                  (c.part || c.title).replace(
                    /^Часть\s+[IVXLC\d]+[.\s:—–-]*/i,
                    "",
                  ),
                )}
              </span>
              <span className="arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </div>
        <div className="book-callout">
          <div>
            <h3>
              Книга, к которой можно
              <br />
              вернуться с новым вопросом.
            </h3>
            <p>
              Читайте по главам. Текст будет дополняться по мере работы авторов.
            </p>
          </div>
          <Link href="/read/" className="button">
            Начать чтение <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <AuthorsGrid compact />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replaceAll("<", "\\u003c"),
        }}
      />
    </main>
  );
}
