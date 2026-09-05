"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { EvidenceCard, LibrarySource } from "@/types/library";
import styles from "./WikiCatalog.module.css";

type CatalogCard = Pick<EvidenceCard, "id" | "sourceId" | "title" | "topics" | "tags" | "context">;
type CatalogSource = Pick<LibrarySource, "id" | "title" | "authors">;

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
}

function preview(context: string): string {
  if (context.length <= 260) return context;
  const end = context.lastIndexOf(" ", 260);
  return context.slice(0, end > 0 ? end : 260).trimEnd() + "…";
}

export function WikiCatalog({
  items,
  sourceItems,
  topics,
}: {
  items: CatalogCard[];
  sourceItems: CatalogSource[];
  topics: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const sourceById = useMemo(
    () => new Map(sourceItems.map((source) => [source.id, source])),
    [sourceItems],
  );
  const filtered = useMemo(() => {
    const words = normalized(query).split(/\s+/u).filter(Boolean);
    return items.filter((item) => {
      if (topic && !item.topics.includes(topic)) return false;
      const text = normalized([item.title, ...item.tags, ...item.topics, item.context].join(" "));
      return words.every((word) => text.includes(word));
    });
  }, [items, query, topic]);
  const hasFilters = query.length > 0 || topic.length > 0;

  function reset() {
    setQuery("");
    setTopic("");
    searchInput.current?.focus();
  }

  return (
    <section className={styles.catalog} aria-label="Каталог исторических свидетельств">
      <form
        role="search"
        className={styles.filters}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={styles.searchField}>
          <label htmlFor="wiki-query">Найти свидетельство</label>
          <input
            ref={searchInput}
            id="wiki-query"
            type="search"
            name="query"
            placeholder="Например, наставник или проверка"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-controls="wiki-results"
            aria-describedby="wiki-search-hint"
            autoComplete="off"
          />
          <p id="wiki-search-hint" className={styles.hint}>
            Поиск по названиям, ключевым словам и контексту.
          </p>
        </div>
        <div className={styles.topicField}>
          <label htmlFor="wiki-topic">Тема</label>
          <select
            id="wiki-topic"
            name="topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            aria-controls="wiki-results"
          >
            <option value="">Все темы</option>
            {topics.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </form>
      <div className={styles.resultsHeader}>
        <p role="status" aria-live="polite" aria-atomic="true">
          {hasFilters ? "Найдено материалов" : "Материалов"}: {filtered.length} из {items.length}
        </p>
        <button type="button" onClick={reset} disabled={!hasFilters}>
          Сбросить фильтры <span aria-hidden="true">↺</span>
        </button>
      </div>
      <div id="wiki-results">
        {filtered.length ? (
          <ol className={styles.list}>
            {filtered.map((card) => {
              const source = sourceById.get(card.sourceId);
              const number = items.findIndex((item) => item.id === card.id) + 1;
              return (
                <li key={card.id}>
                  <Link href={`/wiki/${card.id}/`} className={styles.row}>
                    <span className={styles.number} aria-hidden="true">
                      {String(number).padStart(2, "0")}
                    </span>
                    <div className={styles.main}>
                      <h2>{card.title}</h2>
                      {source && (
                        <p className={styles.source}>
                          {source.authors.join(", ")} · {source.title}
                        </p>
                      )}
                      <p className={styles.preview}>{preview(card.context)}</p>
                      <ul className={styles.topics} aria-label="Темы">
                        {card.topics.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <span className={styles.arrow} aria-hidden="true">↗</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className={styles.empty}>
            <h2>Свидетельства не найдены</h2>
            <p>Попробуйте другое слово или снимите фильтр по теме.</p>
            <button type="button" onClick={reset}>Показать все материалы <span aria-hidden="true">↗</span></button>
          </div>
        )}
      </div>
    </section>
  );
}
