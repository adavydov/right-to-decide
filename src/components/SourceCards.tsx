"use client";

import { useId, useMemo, useState } from "react";
import type { LibrarySourceCard } from "@/types/library-v10";
import { libraryQueryWords, matchesLibraryWords, sourceCardSearchText } from "@/lib/library-search";
import styles from "./BibliographyCatalog.module.css";

export function SourceCards({cards}: {cards: LibrarySourceCard[]}) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const found = useMemo(() => {
    const words = libraryQueryWords(query);
    return cards.filter(card => matchesLibraryWords(sourceCardSearchText(card), words));
  }, [cards, query]);
  return <div>
    <div className={styles.cardSearch}>
      <label htmlFor={inputId}>Поиск по мыслям этого источника</label>
      <input id={inputId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Мысль или вопрос" />
    </div>
    <div className={styles.resultLine}>
      <p role="status">Показано {found.length} из {cards.length}</p>
      {query && <button type="button" onClick={() => setQuery("")}>Сбросить поиск</button>}
    </div>
    {found.length === 0 && <div className={styles.empty}><h3>Совпадений нет</h3><p>Попробуйте другое слово или вернитесь ко всем мыслям источника.</p><button type="button" onClick={() => setQuery("")}>Показать все карточки</button></div>}
    <ol className={styles.sourceCards}>{found.map(card => <li key={card.id} id={card.id}>
      <article className={styles.sourceCard} aria-labelledby={card.id + "-title"}>
        <p className={styles.cardNumber}>{String(cards.findIndex(item => item.id === card.id) + 1).padStart(2, "0")}</p>
        <div className={styles.cardContent}>
          <h3 id={card.id + "-title"}>{card.title}</h3>
          <p className={styles.cardIdea}>{card.idea}</p>
          <div className={styles.cardApplication}><p className={styles.cardLabel}>Для книги</p><p>{card.application}</p></div>
          {card.quote && <figure className={styles.cardQuote}>
            <blockquote><p>{card.quote.text}</p></blockquote>
            <figcaption>{card.quote.attribution}<span>{card.quote.locator}</span></figcaption>
          </figure>}
          {card.mechanism && <div className={styles.cardMechanism}><p className={styles.cardLabel}>Как это работает</p><p>{card.mechanism}</p></div>}
          {card.limits && card.limits.length > 0 && <details className={styles.cardDetails}>
            <summary>Контекст и границы <span aria-hidden="true">+</span></summary>
            <ul>{card.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>
          </details>}
          <details className={styles.cardDetails}>
            <summary>Место в источнике <span aria-hidden="true">+</span></summary>
            <p className={styles.locator}>{card.locator}</p>
          </details>
          <a className={styles.cardPermalink} href={"#" + card.id}>Ссылка на мысль <span aria-hidden="true">#</span></a>
        </div>
      </article>
    </li>)}</ol>
  </div>;
}
