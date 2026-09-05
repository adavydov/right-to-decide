"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ChapterNavigation } from "@/lib/book-display";
import { displayBookTitle } from "@/lib/book-display";
import styles from "./ContentsCatalog.module.css";
export function ContentsCatalog({ items }: { items: ChapterNavigation[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      items.filter((c) =>
        [c.title, c.part, ...(c.headings ?? [])]
          .join(" ")
          .toLocaleLowerCase("ru")
          .includes(query.trim().toLocaleLowerCase("ru")),
      ),
    [items, query],
  );
  const groups = Array.from(
    new Set(
      filtered.map(
        (c) =>
          c.part ||
          (c.kind === "frontmatter"
            ? "Перед началом"
            : c.kind === "appendix"
              ? "Приложения"
              : "После основных глав"),
      ),
    ),
  );
  return (
    <div>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Найти главу или тему"
            aria-label="Поиск по содержанию"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className={styles.count} role="status">
          {query
            ? "Найдено разделов: " + filtered.length
            : `${items.filter(c => c.kind === "chapter" && c.status === "available").length} глав для чтения${items.some(c => c.status === "planned") ? " · " + items.filter(c => c.kind === "chapter" && c.status === "planned").length + " готовятся" : ""}${items.some(c => c.kind === "appendix") ? " · " + items.filter(c => c.kind === "appendix").length + " приложений" : ""}`}
        </span>
      </div>
      {filtered.length === 0 ? (
        <p className="empty-message">
          Разделов по этому запросу не найдено. Попробуйте другое слово.
        </p>
      ) : (
        groups.map((group) => (
          <section className={styles.group} key={group} id={/^часть /i.test(group) ? "part-" + group.split(/[ .]/)[1].toLowerCase() : undefined}>
            <h2>{displayBookTitle(group)}</h2>
            <div>
              {filtered
                .filter(
                  (c) =>
                    (c.part ||
                      (c.kind === "frontmatter"
                        ? "Перед началом"
                        : c.kind === "appendix"
                          ? "Приложения"
                          : "После основных глав")) === group,
                )
                .map((c) => {
                  const inner = (
                    <>
                      <span className={styles.number}>
                        {c.number === null
                          ? "—"
                          : String(c.number).padStart(
                              c.kind === "chapter" ? 2 : 1,
                              "0",
                            )}
                      </span>
                      <span className={styles.title}>
                        {displayBookTitle(c.title).replace(
                          /^Глава \d+[.\s]+/i,
                          "",
                        )}
                      </span>
                      <span className={styles.meta}>
                        {c.status === "available"
                          ? c.minutes + " мин"
                          : "Готовится"}
                      </span>
                      <span aria-hidden="true">
                        {c.status === "available" ? "↗" : "·"}
                      </span>
                    </>
                  );
                  return c.status === "available" ? (
                    <Link
                      className={styles.row}
                      href={"/read/" + c.id + "/"}
                      key={c.id}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className={styles.row} aria-disabled="true" key={c.id}>
                      {inner}
                    </div>
                  );
                })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
