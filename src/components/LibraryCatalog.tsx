"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type {
  EvidenceCard, LibraryAvailability, LibrarySource,
  SpaceLibraryProject, SpaceLibrarySource,
} from "@/types/library";
import styles from "./LibraryCatalog.module.css";

type Kind = "all" | "sources" | "history" | "space" | "projects";
type CatalogCard = Pick<EvidenceCard, "id" | "sourceId" | "title" | "topics" | "tags" | "context">;
type Props = {
  items: LibrarySource[];
  cards: CatalogCard[];
  spaceSources: SpaceLibrarySource[];
  projects: SpaceLibraryProject[];
  availabilityLabels: Record<LibraryAvailability, string>;
  spaceNote: string;
};

const sections: { id: Exclude<Kind, "all">; title: string; description: string }[] = [
  { id: "sources", title: "Книги и исследования", description: "Издания об инженерии, образовании, интеллекте и устройстве общества. У каждого — сведения о доступном тексте и ссылки для чтения." },
  { id: "history", title: "Исторические свидетельства", description: "Фрагменты воспоминаний, их контекст и связь с вопросами книги. Свидетельство сохраняет взгляд автора; рядом с нашим прочтением указаны границы вывода." },
  { id: "space", title: "Космос", description: "Ресурсы, маршруты, энергия, рынки и право: источники, к которым обращаются космические исследования книги." },
  { id: "projects", title: "Исследовательские проекты", description: "Два способа проверить космический замысел: через будущего покупателя и через ограничения производства. Их модели помогают ставить вопросы; полёт и окупаемость остаются предметом проверки." },
];

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
}

function preview(value: string) {
  if (value.length <= 260) return value;
  const end = value.lastIndexOf(" ", 260);
  return value.slice(0, end > 0 ? end : 260).trimEnd() + "…";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(value + "T00:00:00Z"));
}

export function LibraryCatalog({ items, cards, spaceSources, projects, availabilityLabels, spaceNote }: Props) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const searchInput = useRef<HTMLInputElement>(null);
  const sourceById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const cardById = useMemo(() => new Map(cards.map((item) => [item.id, item])), [cards]);
  const spaceById = useMemo(() => new Map(spaceSources.map((item) => [item.id, item])), [spaceSources]);

  const filtered = useMemo(() => {
    const words = normalized(query).split(/\s+/u).filter(Boolean);
    const matches = (parts: string[]) => {
      const text = normalized(parts.join(" "));
      return words.every((word) => text.includes(word));
    };
    return {
      sources: items.filter((item) => matches([item.title, ...item.authors, ...(item.contributors ?? []), item.category, item.edition, item.materialNote])),
      history: cards.filter((item) => matches([item.title, item.context, ...item.topics, ...item.tags, sourceById.get(item.sourceId)?.title ?? "", ...(sourceById.get(item.sourceId)?.authors ?? [])])),
      space: spaceSources.filter((item) => matches([item.title, item.originalTitle, item.publisher, item.topic, item.catalog])),
      projects: projects.filter((item) => matches([item.title, item.subtitle, item.description, ...item.questions])),
    };
  }, [query, items, cards, spaceSources, projects, sourceById]);

  const total = items.length + cards.length + spaceSources.length + projects.length;
  const found = kind === "all"
    ? Object.values(filtered).reduce((sum, group) => sum + group.length, 0)
    : filtered[kind].length;
  const hasFilters = query.length > 0 || kind !== "all";
  const shownSections = sections.filter((section) =>
    (kind === "all" || kind === section.id) && filtered[section.id].length > 0,
  );

  function reset() {
    setQuery("");
    setKind("all");
    searchInput.current?.focus();
  }

  function revealSource(id: string) {
    setQuery("");
    setKind("all");
    requestAnimationFrame(() => {
      window.location.hash = id;
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });
  }

  return (
    <section className={styles.catalog} aria-label="Единая библиотека">
      <form className={styles.toolbar} role="search" onSubmit={(event) => event.preventDefault()}>
        <label className={styles.search} htmlFor="library-search">
          <span className={styles.label}>Поиск по всей библиотеке</span>
          <input
            ref={searchInput}
            id="library-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Автор, название, тема или проект"
            autoComplete="off"
            aria-controls="library-results"
          />
        </label>
        <button type="button" className={styles.reset} onClick={reset} disabled={!hasFilters}>
          Сбросить
        </button>
        <fieldset className={styles.filters}>
          <legend className={styles.label}>Раздел</legend>
          <div className={styles.filterOptions}>
            {([
              { id: "all", title: "Всё", count: Object.values(filtered).reduce((sum, group) => sum + group.length, 0) },
              { id: "sources", title: "Источники", count: filtered.sources.length },
              { id: "history", title: "Свидетельства", count: filtered.history.length },
              { id: "space", title: "Космос", count: filtered.space.length },
              { id: "projects", title: "Проекты", count: filtered.projects.length },
            ] as { id: Kind; title: string; count: number }[]).map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={kind === filter.id}
                aria-controls="library-results"
                className={styles.filter}
                onClick={() => setKind(filter.id)}
              >
                {filter.title} <span className={styles.filterCount}>{filter.count}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </form>

      <div className={styles.resultBar}>
        <p className={styles.resultCount} role="status" aria-live="polite" aria-atomic="true">
          {hasFilters ? "Найдено" : "В библиотеке"}: {found} {hasFilters && <span>из {total}</span>}
        </p>
        {kind === "all" && shownSections.length > 1 && (
          <nav className={styles.jumps} aria-label="Перейти к разделу библиотеки">
            {shownSections.map((section) => (
              <a key={section.id} href={"#" + section.id}>
                {section.id === "sources" ? "Источники" : section.id === "history" ? "Свидетельства" : section.title}
                <span aria-hidden="true"> ↓</span>
              </a>
            ))}
          </nav>
        )}
      </div>

      <div id="library-results">
        {found === 0 && (
          <div className={styles.empty}>
            <h2>Материалы не найдены</h2>
            <p>Попробуйте другое слово или расширьте поиск на всю библиотеку.</p>
            <button type="button" className={styles.emptyReset} onClick={reset}>
              Показать всю библиотеку <span aria-hidden="true">↗</span>
            </button>
          </div>
        )}

        {shownSections.map((section) => (
          <section className={styles.section} id={section.id} key={section.id} aria-labelledby={section.id + "-heading"}>
            <header className={styles.sectionHeader}>
              <h2 id={section.id + "-heading"}>{section.title}</h2>
              <p>{section.description}</p>
            </header>

            {section.id === "sources" && (
              <>
                <p className={styles.sectionNote}>
                  Наличие текста относится к исследовательской библиотеке. Публичный доступ указан у каждой ссылки.
                </p>
                <ol className={styles.list}>
                  {filtered.sources.map((source) => (
                    <li className={styles.row} id={source.id} key={source.id} value={source.number}>
                      <span className={styles.number} aria-hidden="true">{String(source.number).padStart(2, "0")}</span>
                      <div className={styles.main}>
                        <p className={styles.category}>{source.category}</p>
                        {source.authors.length > 0 && <p className={styles.authors}>{source.authors.join(", ")}</p>}
                        {source.contributors?.map((contributor) => <p className={styles.contributor} key={contributor}>{contributor}</p>)}
                        <h3 className={styles.title} id={source.id + "-title"}>{source.title}</h3>
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
                            <summary>Свидетельства из этой книги · {source.cardIds.length}</summary>
                            <ul>
                              {source.cardIds.map((id) => (
                                <li key={id}>
                                  <Link href={"/wiki/" + id + "/"}>{cardById.get(id)?.title ?? id}<span aria-hidden="true"> ↗</span></Link>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                      <div className={styles.access} aria-labelledby={source.id + "-title"}>
                        <p className={styles.availability}>{availabilityLabels[source.availability]}</p>
                        <p className={styles.language}>{source.languages.map((language) => language === "ru" ? "Русский" : language === "en" ? "Английский" : language).join(" · ")}</p>
                        <ul className={styles.links}>
                          {source.links.map((link) => (
                            <li key={link.url}>
                              <a href={link.url} target="_blank" rel="noopener noreferrer">
                                <span>{link.label}</span><span aria-hidden="true">↗</span>
                              </a>
                              {link.note && <p>{link.note}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {section.id === "history" && (
              <ol className={styles.list}>
                {filtered.history.map((card) => {
                  const source = sourceById.get(card.sourceId);
                  return (
                    <li key={card.id}>
                      <Link href={"/wiki/" + card.id + "/"} className={styles.witness}>
                        <div className={styles.main}>
                          <p className={styles.category}>{card.topics.join(" · ")}</p>
                          <h3 className={styles.title}>{card.title}</h3>
                          <p className={styles.materialNote}>{preview(card.context)}</p>
                          {source && <p className={styles.edition}>{source.authors.join(", ")} · {source.title}</p>}
                        </div>
                        <span className={styles.arrow} aria-hidden="true">↗</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}

            {section.id === "space" && (
              <>
                <p className={styles.sectionNote}>{spaceNote}</p>
                <ol className={styles.spaceList}>
                  {filtered.space.map((source) => (
                    <li id={source.id} className={styles.spaceRow} key={source.id}>
                      <p className={styles.category}>{source.topic}</p>
                      <h3 className={styles.title}>
                        <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<span aria-hidden="true"> ↗</span></a>
                      </h3>
                      <p className={styles.edition}>{source.publisher} · {source.originalTitle}</p>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {section.id === "projects" && (
              <div className={styles.projects}>
                {filtered.projects.map((project) => (
                  <article id={project.id} key={project.id} className={styles.project}>
                    <p className={styles.category}>Исследовательский проект · v{project.version} · <time dateTime={project.date}>{dateLabel(project.date)}</time></p>
                    <h3 className={styles.projectTitle}>{project.title}</h3>
                    <p className={styles.projectSubtitle}>{project.subtitle}</p>
                    <p className={styles.materialNote}>{project.description}</p>
                    <details className={styles.projectQuestions}>
                      <summary>Какие решения исследует</summary>
                      <ul>{project.questions.map((question) => <li key={question}>{question}</li>)}</ul>
                    </details>
                    <p className={styles.boundary}>{project.boundary}</p>
                    <div className={styles.relatedSources}>
                      <p className={styles.label}>Источники для продолжения</p>
                      <ul>
                        {project.sourceIds.map((id) => (
                          <li key={id}>
                            <a href={"#" + id} onClick={(event) => { event.preventDefault(); revealSource(id); }}>
                              {spaceById.get(id)?.title ?? id} <span aria-hidden="true">↗</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
