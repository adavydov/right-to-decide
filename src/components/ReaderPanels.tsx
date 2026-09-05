"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import type { ChapterNavigation } from "@/lib/book-display";
import { displayBookTitle } from "@/lib/book-display";
import type {
  ReaderBookmark,
  ReaderHeading,
  ReaderPanel,
  ReaderSearchResult,
  ReaderSettings,
} from "@/lib/reader";
import { defaultReaderSettings } from "@/lib/reader";
import styles from "./ReaderPanels.module.css";

type ReaderPanelsProps = {
  panel: ReaderPanel | null;
  onClose: () => void;
  settings: ReaderSettings;
  onSettingsChange: (settings: ReaderSettings) => void;
  items: ChapterNavigation[];
  currentId: string;
  headings: ReaderHeading[];
  query: string;
  onQueryChange: (query: string) => void;
  results: ReaderSearchResult[];
  onJump: (id: string) => void;
  bookmarks: ReaderBookmark[];
  onBookmarkOpen: (bookmark: ReaderBookmark) => void;
  onBookmarkRemove: (id: string) => void;
  onBookmarkAdd: () => void;
};

const panelTitles: Record<ReaderPanel, string> = {
  contents: "Содержание",
  search: "Поиск по главе",
  settings: "Настройки чтения",
  bookmarks: "Закладки",
};

function groupName(chapter: ChapterNavigation) {
  return chapter.part || (chapter.kind === "frontmatter"
    ? "Перед началом"
    : chapter.kind === "appendix" ? "Приложения" : "После основных глав");
}

export function ReaderPanels({
  panel, onClose, settings, onSettingsChange, items, currentId, headings,
  query, onQueryChange, results, onJump, bookmarks, onBookmarkOpen,
  onBookmarkRemove, onBookmarkAdd,
}: ReaderPanelsProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const sizeId = useId();
  const searchId = useId();
  const groups = Array.from(new Set(items.map(groupName)));

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (panel) {
      if (!element.open) {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        element.showModal();
      }
      (panel === "search" ? search.current : heading.current)?.focus({ preventScroll: true });
    } else if (element.open) {
      element.close();
      opener.current?.focus({ preventScroll: true });
    }
  }, [panel]);

  useEffect(() => {
    const element = dialog.current;
    return () => {
      if (element?.open) {
        element.close();
        opener.current?.focus({ preventScroll: true });
      }
    };
  }, []);

  function updateSettings(change: Partial<ReaderSettings>) {
    onSettingsChange({ ...settings, ...change });
  }

  function jump(id: string) {
    onClose();
    onJump(id);
  }

  return (
    <dialog
      ref={dialog}
      className={styles.panel}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
    >
      <div className={styles.header}>
        <h2 ref={heading} id={titleId} tabIndex={-1}>{panel ? panelTitles[panel] : "Чтение"}</h2>
        <button type="button" className={styles.close} aria-label="Закрыть панель" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>

      {panel === "settings" && (
        <div className={styles.body}>
          <div className={styles.setting}>
            <div className={styles.labelRow}>
              <label htmlFor={sizeId}>Размер текста</label>
              <output htmlFor={sizeId}>{settings.size} px</output>
            </div>
            <div className={styles.rangeRow}>
              <span aria-hidden="true" className={styles.smallA}>А</span>
              <input id={sizeId} type="range" min="16" max="28" step="2" value={settings.size} onChange={(event) => updateSettings({ size: Number(event.target.value) })} />
              <span aria-hidden="true" className={styles.largeA}>А</span>
            </div>
          </div>
          <fieldset className={styles.setting}>
            <legend>Шрифт</legend>
            <div className={styles.options}>
              <button type="button" className={styles.serif} aria-pressed={settings.font === "serif"} onClick={() => updateSettings({ font: "serif" })}>С засечками</button>
              <button type="button" aria-pressed={settings.font === "sans"} onClick={() => updateSettings({ font: "sans" })}>Без засечек</button>
            </div>
          </fieldset>
          <fieldset className={styles.setting}>
            <legend>Тема</legend>
            <div className={styles.options}>
              {([
                ["light", "Светлая"], ["sepia", "Сепия"], ["dark", "Тёмная"],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" className={styles.themeOption} aria-pressed={settings.theme === value} onClick={() => updateSettings({ theme: value })}>
                  <span className={styles.swatch} data-theme={value} aria-hidden="true">А</span>{label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.setting}>
            <legend>Межстрочный интервал</legend>
            <div className={styles.options}>
              {[1.5, 1.8, 2.1].map((value) => (
                <button key={value} type="button" aria-pressed={settings.spacing === value} onClick={() => updateSettings({ spacing: value })}>{String(value).replace(".", ",")}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.setting}>
            <legend>Ширина строки</legend>
            <div className={styles.options}>
              {([["narrow", "Узкая"], ["normal", "Обычная"], ["wide", "Широкая"]] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={settings.width === value} onClick={() => updateSettings({ width: value })}>{label}</button>
              ))}
            </div>
          </fieldset>
          <button type="button" className={styles.textButton} onClick={() => onSettingsChange({ ...defaultReaderSettings })}>Сбросить настройки</button>
          <p className={styles.note}>Настройки сохраняются в этом браузере.</p>
        </div>
      )}

      {panel === "contents" && (
        <nav className={styles.contents} aria-label="Главы книги">
          {groups.map((group) => (
            <section className={styles.chapterGroup} key={group}>
              <h3>{displayBookTitle(group)}</h3>
              <ol>
                {items.filter((item) => groupName(item) === group).map((item) => (
                  <li key={item.id}>
                    {item.status === "available" ? (
                      <Link className={styles.chapterLink} href={"/read/" + item.id + "/"} aria-current={item.id === currentId ? "page" : undefined} onClick={onClose}>
                        <span>{displayBookTitle(item.title)}</span>
                        {item.id === currentId && <span className={styles.currentLabel}>Вы здесь</span>}
                      </Link>
                    ) : (
                      <span className={styles.planned}>{displayBookTitle(item.title)}<span>Скоро</span></span>
                    )}
                    {item.id === currentId && headings.length > 0 && (
                      <ol className={styles.headings} aria-label="Разделы текущей главы">
                        {headings.map((item) => <li key={item.id}><button type="button" onClick={() => jump(item.id)}>{displayBookTitle(item.title)}</button></li>)}
                      </ol>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </nav>
      )}

      {panel === "search" && (
        <div className={styles.body}>
          <label className={styles.searchLabel} htmlFor={searchId}>Поиск по главе</label>
          <input ref={search} className={styles.search} id={searchId} type="search" placeholder="Слово или фраза" value={query} onChange={(event) => onQueryChange(event.target.value)} autoComplete="off" />
          <p className={styles.note} role="status" aria-live="polite">
            {!query.trim() ? "Введите слово или фразу. Поиск работает в открытой главе." : results.length ? "Найдено фрагментов: " + results.length : "Совпадений в этой главе нет. Попробуйте другое слово."}
          </p>
          {query.trim() && results.length > 0 && (
            <ol className={styles.results}>
              {results.map((result, index) => (
                <li key={result.id}>
                  <button type="button" data-reader-search-result aria-label={"Перейти к результату " + (index + 1) + ": " + result.excerpt} onClick={() => jump(result.id)}>
                    <span className={styles.resultNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <span>{result.excerpt}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {panel === "bookmarks" && (
        <div className={styles.body}>
          <button type="button" className={styles.addBookmark} onClick={onBookmarkAdd}>Добавить закладку здесь <span aria-hidden="true">+</span></button>
          <p className={styles.note}>Закладки сохраняются только в этом браузере.</p>
          {bookmarks.length === 0 ? (
            <p className={styles.empty}>Здесь появятся сохранённые места. Добавьте закладку, чтобы вернуться к этому фрагменту.</p>
          ) : (
            <ul className={styles.bookmarks}>
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id}>
                  <button type="button" className={styles.bookmarkOpen} aria-label={"Открыть закладку: " + displayBookTitle(bookmark.title)} onClick={() => { onClose(); onBookmarkOpen(bookmark); }}>
                    <span className={styles.bookmarkTitle}>{displayBookTitle(bookmark.title)}</span>
                    <span className={styles.bookmarkExcerpt}>{bookmark.excerpt}</span>
                    <span className={styles.bookmarkProgress}>{Math.round(bookmark.progress * 100)}% главы</span>
                  </button>
                  <button type="button" className={styles.removeBookmark} aria-label={"Удалить закладку: " + displayBookTitle(bookmark.title)} onClick={() => onBookmarkRemove(bookmark.id)}>Удалить</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </dialog>
  );
}
