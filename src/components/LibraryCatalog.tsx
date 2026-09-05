"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LibraryAvailability, LibrarySource } from "@/types/library";
import styles from "./LibraryCatalog.module.css";

type MaterialFilter = "all" | "cards" | "full";
type Props = {
  items: LibrarySource[];
  cardTitles: Record<string, string>;
  cardCount: number;
  availabilityLabels: Record<LibraryAvailability, string>;
};

const materialFilters: { value: MaterialFilter; label: string }[] = [
  { value: "all", label: "Все источники" },
  { value: "cards", label: "С карточками вики" },
  { value: "full", label: "Имеется полный текст" },
];

function normalizeQuery(value: string) {
  return value.toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
}

function plural(count: number, forms: [string, string, string]) {
  const lastTwo = count % 100;
  const last = count % 10;
  return lastTwo >= 11 && lastTwo <= 14
    ? forms[2]
    : last === 1
      ? forms[0]
      : last >= 2 && last <= 4
        ? forms[1]
        : forms[2];
}

export function LibraryCatalog({ items, cardTitles, cardCount, availabilityLabels }: Props) {
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState<MaterialFilter>("all");
  const filtered = useMemo(() => {
    const words = normalizeQuery(query).split(/\s+/).filter(Boolean);
    return items.filter((source) => {
      const text = normalizeQuery(
        [source.title, ...source.authors, ...(source.contributors ?? []), source.category, source.edition].join(" "),
      );
      const matchesText = words.every((word) => text.includes(word));
      const matchesMaterial =
        material === "all" ||
        (material === "cards" && source.cardIds.length > 0) ||
        (material === "full" && ["complete", "provided"].includes(source.availability));
      return matchesText && matchesMaterial;
    });
  }, [items, material, query]);
  const hasFilters = query.length > 0 || material !== "all";
  const reset = () => {
    setQuery("");
    setMaterial("all");
  };

  return (
    <section className={styles.catalog} aria-label="Каталог источников">
      <div className={styles.overview}>
        <p className={styles.total}>
          {items.length} {plural(items.length, ["источник", "источника", "источников"])}
          <span aria-hidden="true"> · </span>
          {cardCount} {plural(cardCount, ["карточка", "карточки", "карточек"])} в вики
        </p>
        <p className={styles.explanation} id="library-status-note">
          Статус описывает исследовательскую библиотеку; доступ в интернете указан
          у каждой ссылки.
        </p>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search} htmlFor="library-search">
          <span className={styles.label}>Найти источник</span>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Автор, название или тема"
            autoComplete="off"
            aria-controls="library-results"
          />
        </label>
        <button
          type="button"
          className={styles.reset}
          onClick={reset}
          disabled={!hasFilters}
        >
          Сбросить
        </button>
        <fieldset className={styles.filters} aria-describedby="library-status-note">
          <legend className={styles.label}>Доступные материалы</legend>
          <div className={styles.filterOptions}>
            {materialFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={material === filter.value}
                aria-controls="library-results"
                className={styles.filter}
                onClick={() => setMaterial(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <p className={styles.resultCount} role="status" aria-live="polite" aria-atomic="true">
        Показано {filtered.length} из {items.length}
      </p>

      <div id="library-results">
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <h2>Источников по этому запросу нет</h2>
            <p>Попробуйте другое имя, название или выберите все материалы.</p>
            <button type="button" className={styles.emptyReset} onClick={reset}>
              Сбросить поиск и фильтр <span aria-hidden="true">↗</span>
            </button>
          </div>
        ) : (
          <ol className={styles.list}>
            {filtered.map((source) => (
              <li className={styles.row} id={source.id} key={source.id} value={source.number}>
                <span className={styles.number} aria-hidden="true">
                  {String(source.number).padStart(2, "0")}
                </span>
                <div className={styles.main}>
                  <p className={styles.category}>{source.category}</p>
                  {source.authors.length > 0 && (
                    <p className={styles.authors}>{source.authors.join(", ")}</p>
                  )}
                  {source.contributors?.map((contributor) => (
                    <p className={styles.contributor} key={contributor}>{contributor}</p>
                  ))}
                  <h2 className={styles.title} id={source.id + "-title"}>{source.title}</h2>
                  <p className={styles.edition}>{source.edition}</p>
                  <p className={styles.materialNote}>{source.materialNote}</p>
                  {source.readingNote && (
                    <details className={styles.reading}>
                      <summary>О чтении источника</summary>
                      <p>{source.readingNote}</p>
                    </details>
                  )}
                  {source.cardIds.length > 0 && (
                    <details className={styles.evidence}>
                      <summary>
                        {source.cardIds.length} {plural(source.cardIds.length, ["карточка", "карточки", "карточек"])} в вики
                      </summary>
                      <ul>
                        {source.cardIds.map((id) => (
                          <li key={id}>
                            <Link href={"/wiki/" + id + "/"}>
                              {cardTitles[id]}
                              <span aria-hidden="true"> ↗</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                <div className={styles.access} aria-labelledby={source.id + "-title"}>
                  <p className={styles.availability}>{availabilityLabels[source.availability]}</p>
                  <p className={styles.language}>
                    {source.languages.map((language) => language === "ru" ? "Русский" : language === "en" ? "Английский" : language).join(" · ")}
                  </p>
                  <ul className={styles.links}>
                    {source.links.map((link) => (
                      <li key={link.url}>
                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                          <span>{link.label}</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                        {link.note && <p>{link.note}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
