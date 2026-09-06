import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cards, getCard, getSource } from "@/lib/library";
import { siteConfig } from "@/lib/site-config";
import styles from "../WikiArticle.module.css";

type WikiPageProps = { params: Promise<{ card: string }> };

export function generateStaticParams() {
  return cards.map((card) => ({ card: card.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: WikiPageProps): Promise<Metadata> {
  const { card: id } = await params;
  const card = getCard(id);
  if (!card) notFound();

  return {
    title: card.title,
    description: card.context,
    alternates: { canonical: siteConfig.publicUrl + "/wiki/" + card.id + "/" },
    openGraph: {
      title: card.title,
      description: card.context,
      url: siteConfig.publicUrl + "/wiki/" + card.id + "/",
      type: "article",
      locale: "ru_RU",
    },
  };
}

function Paragraphs({ text }: { text: string }) {
  return text.split(/\n\s*\n/u).map((paragraph, index) => (
    <p key={index}>{paragraph}</p>
  ));
}

function SourceLocators({ ids }: { ids: string[] }) {
  return (
    <span className={styles.locators}>
      {ids.map((id, index) => (
        <span key={id}>
          {index > 0 && <span aria-hidden="true" className={styles.locatorSeparator}> · </span>}
          <span>{id}</span>
        </span>
      ))}
    </span>
  );
}

export default async function WikiArticlePage({ params }: WikiPageProps) {
  const { card: id } = await params;
  const card = getCard(id);
  if (!card) notFound();
  const source = getSource(card.sourceId);
  if (!source) notFound();
  const related = cards
    .filter((candidate) =>
      candidate.id !== card.id &&
      candidate.topics.some((topic) => card.topics.includes(topic)),
    )
    .slice(0, 3);
  const reviewDate = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(card.review.date + "T00:00:00Z"));

  return (
    <main id="main-content" className={`subpage wrap ${styles.articlePage}`}>
      <nav aria-label="Хлебные крошки" className={styles.breadcrumb}>
        <Link href="/library/">Библиотека</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{card.title}</span>
      </nav>
      <article>
        <header className={styles.articleHeader}>
          <p className="eyebrow">Историческое свидетельство</p>
          <h1 className={styles.articleTitle}>{card.title}</h1>
          <ul className={styles.topicList} aria-label="Темы материала">
            {card.topics.map((topic) => <li key={topic}>{topic}</li>)}
          </ul>
          <div className={styles.sourceIdentity}>
            <p className={styles.smallLabel}>Источник</p>
            <Link href={`/library/#${source.id}`} className={styles.sourceTitle}>
              {source.authors.join(", ")}. {source.title} <span aria-hidden="true">↗</span>
            </Link>
            <p className={styles.edition}>{source.edition}</p>
          </div>
        </header>

        <div className={styles.articleBody}>
          <section className={styles.section} aria-labelledby="wiki-context">
            <h2 id="wiki-context">Контекст</h2>
            <div className={styles.prose}><Paragraphs text={card.context} /></div>
          </section>

          <section className={styles.section} aria-labelledby="wiki-evidence">
            <h2 id="wiki-evidence">Свидетельство</h2>
            <div className={styles.quotes}>
              {card.quotes.map((quote, index) => (
                <figure className={styles.quote} key={index}>
                  <blockquote><p>{quote.text}</p></blockquote>
                  <figcaption>
                    <span className={styles.quoteVoice}>{quote.attribution}</span>
                    <SourceLocators ids={quote.paragraphIds} />
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="wiki-understanding">
            <h2 id="wiki-understanding">Что помогает понять</h2>
            <div className={styles.explanation}>
              <h3>Наблюдение</h3>
              <div className={styles.prose}><Paragraphs text={card.observation} /></div>
            </div>
            <div className={styles.explanation}>
              <h3>Наше прочтение</h3>
              <div className={styles.prose}><Paragraphs text={card.interpretation} /></div>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="wiki-capability">
            <h2 id="wiki-capability">Способность и организация работы</h2>
            <div className={styles.explanation}>
              <h3>Способность участника</h3>
              <div className={styles.prose}><Paragraphs text={card.capability} /></div>
            </div>
            <div className={styles.explanation}>
              <h3>Организация работы</h3>
              <div className={styles.prose}><Paragraphs text={card.workProcedure} /></div>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="wiki-limits">
            <h2 id="wiki-limits">Границы вывода</h2>
            <ul className={styles.limits}>
              {card.limits.map((limit, index) => <li key={index}>{limit}</li>)}
            </ul>
          </section>

          <section className={styles.section} aria-labelledby="wiki-source-location">
            <h2 id="wiki-source-location">Место в источнике</h2>
            <div className={styles.locationGroup}>
              <h3>Разделы</h3>
              <ul className={styles.sectionsList}>
                {card.sections.map((section) => <li key={section}>{section}</li>)}
              </ul>
            </div>
            <div className={styles.locationGroup}>
              <h3>{card.locatorKind === "pdf-page" ? "Страницы PDF-файла" : "Абзацы электронного экземпляра"}</h3>
              <SourceLocators ids={card.paragraphIds} />
            </div>
            <p className={styles.locatorNote}>
              {card.locatorNote ?? "Идентификаторы вида GRABIN1989:P00170 обозначают абзацы использованного электронного экземпляра. В предоставленном FB2 нет разметки печатных страниц; эти номера не являются страницами издания."}
            </p>
            <div className={styles.review}>
              <h3>Сверка с источником</h3>
              <div className={styles.prose}><Paragraphs text={card.review.note} /></div>
              <dl className={styles.reviewFacts}>
                <div>
                  <dt>Соответствие электронному источнику</dt>
                  <dd>{card.review.sourceCorrespondence === "checked" ? "Сверено" : "Не установлено"}</dd>
                </div>
                <div>
                  <dt>Независимое подтверждение событий</dt>
                  <dd>{card.review.historicalCorroboration === "not-established" ? "Не установлено" : "Не указано"}</dd>
                </div>
                <div>
                  <dt>Дата сверки</dt>
                  <dd><time dateTime={card.review.date}>{reviewDate}</time></dd>
                </div>
              </dl>
            </div>
            <Link href={`/library/#${source.id}`} className={styles.textLink}>
              Об издании в библиотеке <span aria-hidden="true">↗</span>
            </Link>
          </section>

          {card.tags.length > 0 && (
            <div className={styles.tags}>
              <p className={styles.smallLabel}>Ключевые слова</p>
              <ul aria-label="Ключевые слова материала">
                {card.tags.map((tag) => <li key={tag}>{tag}</li>)}
              </ul>
            </div>
          )}
        </div>
      </article>
      {related.length > 0 && (
        <section className={styles.related} aria-labelledby="wiki-related">
          <p className="eyebrow">Продолжить исследование</p>
          <h2 id="wiki-related">Другие свидетельства по теме</h2>
          <ul>
            {related.map((item) => (
              <li key={item.id}>
                <Link href={`/wiki/${item.id}/`}>
                  <span>{item.title}</span>
                  <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav className={styles.backlinks} aria-label="Продолжение чтения">
        <Link href="/library/#history">← Все свидетельства</Link>
        <Link href="/library/">Библиотека <span aria-hidden="true">↗</span></Link>
      </nav>
    </main>
  );
}
