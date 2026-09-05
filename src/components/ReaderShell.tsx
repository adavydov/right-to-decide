"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ChapterNavigation } from "@/lib/book-display";
import { displayBookTitle } from "@/lib/book-display";
import styles from "./ReaderShell.module.css";
import {
  useReadingPreference,
  writeReadingPreference,
} from "@/lib/reading-storage";
export function ReaderShell({
  currentId,
  items,
  children,
}: {
  currentId: string;
  items: ChapterNavigation[];
  children: ReactNode;
}) {
  const savedSize = Number(useReadingPreference("right-to-decide-font-size"));
  const size = [18, 20, 22].includes(savedSize) ? savedSize : 20;
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    try {
      const current = items.find((c) => c.id === currentId);
      if (current)
        writeReadingPreference(
          "right-to-decide-reading",
          JSON.stringify({ id: current.id, title: current.title }),
        );
    } catch {}
    if (details.current)
      details.current.open = window.matchMedia("(min-width: 901px)").matches;
  }, [currentId, items]);
  function resize(n: number) {
    writeReadingPreference("right-to-decide-font-size", String(n));
  }
  return (
    <div
      className={styles.layout}
      style={{ "--reader-size": size + "px" } as CSSProperties}
    >
      <aside className={styles.sidebar}>
        <details ref={details}>
          <summary>
            Содержание книги <span aria-hidden="true">⌄</span>
          </summary>
          <nav aria-label="Главы книги">
            {items.map((c) =>
              c.status === "available" ? (
                <Link
                  key={c.id}
                  href={"/read/" + c.id + "/"}
                  className={styles.chapterLink}
                  aria-current={c.id === currentId ? "page" : undefined}
                >
                  {displayBookTitle(c.title)}
                </Link>
              ) : (
                <span className={styles.planned} key={c.id}>
                  {displayBookTitle(c.title)} · скоро
                </span>
              ),
            )}
          </nav>
        </details>
        <Link href="/contents/" className={styles.allContents}>
          Полное содержание ↗
        </Link>
      </aside>
      <div className={styles.articleColumn}>
        <div className={styles.tools}>
          <span>Рабочая редакция · 04.09.2026</span>
          <div role="group" aria-label="Размер текста">
            {[18, 20, 22].map((n, i) => (
              <button
                key={n}
                aria-label={
                  ["Мелкий текст", "Средний текст", "Крупный текст"][i]
                }
                aria-pressed={size === n}
                onClick={() => resize(n)}
                style={{ fontSize: 12 + i * 3 }}
              >
                А
              </button>
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
