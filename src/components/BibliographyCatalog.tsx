"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { Bibliography } from "@/types/library-v10";
import { libraryPlural as plural, libraryQueryWords, matchesLibraryWords, sourceCardSearchText } from "@/lib/library-search";
import styles from "./BibliographyCatalog.module.css";
import { visibleLibrarySources } from "../../shared/library-aliases.mjs";

export function BibliographyCatalog({data}: {data: Bibliography}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [reading, setReading] = useState("");
  const prefix = useId();
  const words = useMemo(() => libraryQueryWords(query), [query]);
  const sources = useMemo(() => visibleLibrarySources(data.sources), [data]);
  const categories = useMemo(() => Array.from(new Set(sources.map(source => source.category))).sort((a,b) => a.localeCompare(b,"ru")), [sources]);
  const readings = useMemo(() => Array.from(new Map(sources.map(source => [source.reading.kind, source.reading.label])).entries()), [sources]);
  const found = useMemo(() => sources.flatMap(source => {
    if ((category && source.category !== category) || (reading && source.reading.kind !== reading)) return [];
    const metadata = [source.title, ...source.authors, source.edition, source.annotation, source.role].join(" ");
    const matchingCards = words.length ? (source.cards ?? []).filter(card => matchesLibraryWords(sourceCardSearchText(card), words)) : [];
    if (words.length && !matchesLibraryWords(metadata, words) && matchingCards.length === 0) return [];
    return [{source, matchingCards}];
  }), [sources, category, reading, words]);
  const cardMatches = found.reduce((sum, item) => sum + item.matchingCards.length, 0);
  const reset = () => { setQuery(""); setCategory(""); setReading(""); };

  return <section aria-label="Библиографический каталог" className={styles.catalog}>
    <div className={styles.overview}>
      <p><strong>{sources.length}</strong> {plural(sources.length,"источник","источника","источников")} <span>·</span> <strong>{data.summary.cards}</strong> {plural(data.summary.cards,"карточка","карточки","карточек")}</p>
      <div><p>{data.readingNote}</p>{data.cardNote && <p>{data.cardNote}</p>}</div>
    </div>
    <div className={styles.filters}>
      <div className={styles.search}><label htmlFor={prefix+"-query"}>Поиск по источникам и мыслям</label><input id={prefix+"-query"} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Автор, название или мысль" /></div>
      <div><label htmlFor={prefix+"-category"}>Тема</label><select id={prefix+"-category"} value={category} onChange={event => setCategory(event.target.value)}><option value="">Все темы</option>{categories.map(value => <option key={value}>{value}</option>)}</select></div>
      <div><label htmlFor={prefix+"-reading"}>Охват чтения</label><select id={prefix+"-reading"} value={reading} onChange={event => setReading(event.target.value)}><option value="">Любой охват</option>{readings.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></div>
    </div>
    <div className={styles.resultLine}>
      <p role="status">Показано {found.length} из {sources.length}{words.length > 0 && cardMatches > 0 && <> · {cardMatches} {plural(cardMatches,"совпадение в карточках","совпадения в карточках","совпадений в карточках")}</>}</p>
      {(query || category || reading) && <button type="button" onClick={reset}>Сбросить фильтры</button>}
    </div>
    {found.length === 0 ? <div className={styles.empty}><h2>Совпадений нет</h2><p>Попробуйте другое слово, имя автора или более широкий охват чтения.</p><button type="button" onClick={reset}>Показать всю библиотеку</button></div> : <ol className={styles.entries}>
      {found.map(({source, matchingCards}) => <li key={source.id} id={source.id} className={styles.entry}>
        <div className={styles.meta}><span>{source.category}</span><span>{source.cardCount > 0 ? `${source.cardCount} ${plural(source.cardCount,"карточка","карточки","карточек")}` : "Карточек нет"}</span></div>
        <div>
          <p className={styles.authors}>{source.authors.length > 4 ? source.authors.slice(0,3).join(" · ") + " и др." : source.authors.join(" · ")}</p>
          <h2><Link href={"/library/" + source.id + "/"}>{source.title}</Link></h2>
          <p className={styles.edition}>{source.edition}</p>
          <p className={styles.annotation}>{source.annotation}</p>
          <details className={styles.scope}><summary>{source.reading.label}<span aria-hidden="true">+</span></summary><div><p>{source.reading.scope}</p><p><strong>В книге.</strong> {source.role}</p></div></details>
          {matchingCards.length > 0 && <div className={styles.matchingThoughts}>
            <p>Мысли по вашему запросу</p>
            <ul>{matchingCards.slice(0,2).map(card => <li key={card.id}>
              <Link href={"/library/" + source.id + "/#" + card.id}>{card.title} <span aria-hidden="true">↗</span></Link>
              <p>{card.idea}</p>
            </li>)}</ul>
            {matchingCards.length > 2 && <p>Ещё {matchingCards.length - 2} {plural(matchingCards.length - 2,"совпадение","совпадения","совпадений")} в карточках источника.</p>}
          </div>}
          <div className={styles.entryActions}>
            <Link className={styles.openSource} href={"/library/" + source.id + "/"}>{source.cardCount > 0 ? "Открыть карточки" : "Открыть запись"} <span aria-hidden="true">↗</span></Link>
            {source.links[0] && <a className={styles.originalLink} href={source.links[0].url} target="_blank" rel="noopener noreferrer">{source.links[0].label} <span aria-hidden="true">↗</span></a>}
          </div>
        </div>
      </li>)}
    </ol>}
  </section>;
}
