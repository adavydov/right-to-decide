import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceCards } from "@/components/SourceCards";
import { findLibrarySource, sourceLibrary } from "@/lib/library-source-cards";
import { libraryPlural } from "@/lib/library-search";
import { siteConfig } from "@/lib/site-config";
import styles from "@/components/BibliographyCatalog.module.css";
import { isLibraryAlias, libraryAliasTargets } from "../../../../shared/library-aliases.mjs";

type Props = { params: Promise<{id: string}> };
export const dynamicParams = false;
export function generateStaticParams() { return sourceLibrary.sources.map(source => ({id: source.id})); }
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {id} = await params;
  const source = findLibrarySource(id);
  if (!source) return {title: "Источник не найден"};
  return {title: source.title, description: source.annotation, alternates: {canonical: siteConfig.publicUrl + "/library/" + source.id + "/"}};
}

export default async function SourcePage({params}: Props) {
  const {id} = await params;
  const source = findLibrarySource(id);
  if (!source) notFound();
  const cards = source.cards ?? [];
  const alias = isLibraryAlias(source);
  const related = libraryAliasTargets(source, sourceLibrary.sources);
  const backHref = alias ? '/library/' : '/library/#' + source.id;
  return <main id="main-content" className={styles.page}>
    <Link className={styles.backLink} href={backHref}>← Библиотека</Link>
    <header className={styles.sourceHeader}>
      <p className={styles.kicker}>{source.category}</p>
      <p className={styles.sourceAuthors}>{source.authors.join(" · ")}</p>
      <h1>{source.title}</h1>
      <p className={styles.sourceEdition}>{source.edition}</p>
      <p className={styles.sourceAnnotation}>{source.annotation}</p>
      <p className={styles.sourceRole}><span>В книге</span>{source.role}</p>
      {source.links.length > 0 && <ul className={styles.sourceLinks}>{source.links.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <span aria-hidden="true">↗</span></a></li>)}</ul>}
    </header>
    <section className={styles.readingScope} aria-labelledby="source-reading-scope">
      <h2 id="source-reading-scope">{source.reading.label}</h2>
      <div><p>{source.reading.scope}</p>{source.sourceNote && <p>{source.sourceNote}</p>}</div>
    </section>
    <section className={styles.sourceCardsSection} aria-labelledby="source-cards-heading">
      <header className={styles.cardsHeading}>
        <h2 id="source-cards-heading">{alias ? "Карточки этой книги" : cards.length > 0 ? `${cards.length} ${libraryPlural(cards.length,"карточка","карточки","карточек")}` : "Карточек пока нет"}</h2>
        {cards.length > 0 && sourceLibrary.cardNote && <p>{sourceLibrary.cardNote}</p>}
      </header>
      {alias ? <><p>Разбор собран на странице другого издания этой книги. Здесь сохранена прежняя библиографическая запись.</p><ul className={styles.sourceLinks}>{related.map(target => <li key={target.id}><Link href={'/library/' + target.id + '/'}>{target.title} — {target.edition} · {target.cardCount} {libraryPlural(target.cardCount,"карточка","карточки","карточек")} ↗</Link></li>)}</ul></> : cards.length > 0 ? <SourceCards cards={cards}/> : <p className={styles.noCards}>Для этой записи в библиотеке нет карточек разбора. Охват источника указан выше.</p>}
    </section>
    <Link className={styles.backLink} href={backHref}>← Вернуться к источникам</Link>
  </main>;
}
