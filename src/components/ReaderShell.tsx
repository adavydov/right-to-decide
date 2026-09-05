"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ChapterNavigation } from "@/lib/book-display";
import { displayBookTitle } from "@/lib/book-display";
import { readReadingPreference, useReadingPreference, writeReadingPreference } from "@/lib/reading-storage";
import { parseBookmarks, parseLocation, parseSettings } from "@/lib/reader";
import type { ReaderBookmark, ReaderHeading, ReaderPanel, ReaderSettings, ReaderSearchResult, ReadingLocation } from "@/lib/reader";
import { ReaderPanels } from "./ReaderPanels";
import { ensureReaderFont, readerFonts } from "@/lib/reader-fonts";
import styles from "./ReaderShell.module.css";

function Icon({ name }: { name: "back" | "next" | "contents" | "search" | "bookmark" | "focus" }) {
  const paths = {
    back: "m14 6-6 6 6 6", next: "m10 6 6 6-6 6",
    contents: "M8 6h12M8 12h12M8 18h12M3 6h1M3 12h1M3 18h1",
    search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    bookmark: "M6 3h12v18l-6-4-6 4V3Z",
    focus: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
const positionKey = (id: string) => `right-to-decide-position:${id}`;
export function ReaderShell({ currentId, items, headings, revision, children }: {
  currentId: string; items: ChapterNavigation[]; headings: ReaderHeading[]; revision: string; children: ReactNode;
}) {
  const router = useRouter();
  const rawSettings = useReadingPreference("right-to-decide-settings");
  const legacySize = useReadingPreference("right-to-decide-font-size");
  const settings = useMemo(() => parseSettings(rawSettings, legacySize), [rawSettings, legacySize]);
  const rawBookmarks = useReadingPreference("right-to-decide-bookmarks");
  const allBookmarks = useMemo(() => parseBookmarks(rawBookmarks), [rawBookmarks]);
  const bookmarks = useMemo(() => allBookmarks.filter(b => b.revision === revision && items.some(c => c.id === b.chapterId && c.status === "available")), [allBookmarks, items, revision]);
  const [panel, setPanel] = useState<ReaderPanel | null>(null);
  const [focus, setFocus] = useState(false);
  const [progress, setProgress] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReaderSearchResult[]>([]);
  const [notice, setNotice] = useState("");
  const [draftSettings, setDraftSettings] = useState<ReaderSettings | null>(null);
  const [fontReady, setFontReady] = useState(false);
  const article = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  const pending = useRef<ReadingLocation | null>(null);
  const fontChangeVersion = useRef(0);
  const current = items.find(c => c.id === currentId)!;
  const available = items.filter(c => c.status === "available");
  const index = available.findIndex(c => c.id === currentId);
  const previous = available[index - 1];
  const next = available[index + 1];
  const blocks = useRef<HTMLElement[]>([]);

  const capture = useCallback((): ReadingLocation => {
    const elements = blocks.current;
    let low = 0, high = elements.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (elements[mid].getBoundingClientRect().top <= 112) low = mid;
      else high = mid - 1;
    }
    const element = elements[low];
    const rect = element?.getBoundingClientRect();
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return {
      blockId: window.scrollY < 120 ? "" : element?.id || "",
      offset: rect ? Math.max(0, Math.min(1, (112 - rect.top) / Math.max(1, rect.height))) : 0,
      progress: max ? Math.max(0, Math.min(1, window.scrollY / max)) : 1,
      revision,
    };
  }, [revision]);

  const restore = useCallback((location: ReadingLocation) => {
    if (location.revision && location.revision !== revision) {
      window.scrollTo({ top: 0, behavior: "instant" });
      setNotice("Текст обновился. Чтение этой редакции начато с начала.");
      return;
    }
    const element = location.revision === revision ? document.getElementById(location.blockId) : null;
    const top = element && article.current?.contains(element)
      ? window.scrollY + element.getBoundingClientRect().top + element.getBoundingClientRect().height * location.offset - 112
      : location.progress * Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }, [revision]);

  const jump = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (!element || !article.current?.contains(element)) return;
    window.history.replaceState(null, "", "#" + encodeURIComponent(id));
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 112, behavior: "instant" });
    if (!element.hasAttribute("tabindex")) element.tabIndex = -1;
    requestAnimationFrame(() => element.focus({ preventScroll: true }));
    setPanel(null);
  }, []);

  useEffect(() => {
    blocks.current = Array.from(article.current?.querySelectorAll<HTMLElement>("[data-reader-block]") || []);
    let frame = 0, startFrame = 0, saveTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const fontRequests = fontChangeVersion;
    const initialFontChangeVersion = fontRequests.current;
    ready.current = false;
    let lastLocation: ReadingLocation | null = null;
    const save = () => {
      if (!ready.current) return;
      const position = article.current?.isConnected ? capture() : lastLocation;
      if (!position) return;
      lastLocation = position;
      writeReadingPreference(positionKey(currentId), JSON.stringify(position), false);
      writeReadingPreference("right-to-decide-reading", JSON.stringify({ id: currentId, title: current.title, revision, progress: position.progress }), false);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (ready.current) { lastLocation = capture(); setProgress(lastLocation.progress); }
      });
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 700);
    };
    const hashJump = () => {
      let id = "";
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch {}
      if (id && document.getElementById(id)) jump(id);
    };
    const initialize = async () => {
      const savedSettings = parseSettings(
        readReadingPreference("right-to-decide-settings"),
        readReadingPreference("right-to-decide-font-size"),
      );
      try {
        await ensureReaderFont(savedSettings.font, savedSettings.size);
        if (!disposed && fontRequests.current === initialFontChangeVersion) setFontReady(true);
      } catch {
        if (!disposed && fontRequests.current === initialFontChangeVersion)
          setNotice("Шрифт пока недоступен. Текст показан запасным шрифтом.");
      }
      if (disposed) return;
      startFrame = requestAnimationFrame(() => {
        startFrame = requestAnimationFrame(() => {
          if (disposed) return;
          if (window.location.hash) hashJump();
          else if (fontRequests.current === initialFontChangeVersion) {
            const saved = parseLocation(readReadingPreference(positionKey(currentId)));
            if (saved) restore(saved);
            else window.scrollTo({ top: 0, behavior: "instant" });
          }
          ready.current = true;
          update();
          save();
        });
      });
    };
    void initialize();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("pagehide", save);
    window.addEventListener("hashchange", hashJump);
    return () => {
      save(); ready.current = false; disposed = true;
      fontRequests.current++;
      cancelAnimationFrame(startFrame); cancelAnimationFrame(frame); clearTimeout(saveTimer);
      window.removeEventListener("scroll", update); window.removeEventListener("resize", update);
      window.removeEventListener("pagehide", save); window.removeEventListener("hashchange", hashJump);
    };
  }, [currentId, current.title, revision, capture, restore, jump]);

  useLayoutEffect(() => {
    if (!pending.current) return;
    const location = pending.current;
    pending.current = null;
    restore(location);
  }, [settings, fontReady, restore]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !panel) setFocus(false);
      const target = e.target as HTMLElement;
      if (panel || target.closest("input,textarea,select,button,a,.table-scroll,[contenteditable='true']") || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        window.scrollBy({ top: (e.key === "ArrowRight" ? 1 : -1) * (window.innerHeight - 180), behavior: "instant" });
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [panel]);

  async function changeSettings(value: ReaderSettings) {
    const request = ++fontChangeVersion.current;
    setDraftSettings(value);
    try { await ensureReaderFont(value.font, value.size); }
    catch {
      if (request === fontChangeVersion.current && article.current?.isConnected) {
        setDraftSettings(null);
        setNotice("Не удалось загрузить шрифт. Попробуйте ещё раз.");
      }
      return;
    }
    if (request !== fontChangeVersion.current || !article.current?.isConnected) return;
    pending.current = window.scrollY < 120 ? { blockId: "", offset: 0, progress: 0, revision: "" } : capture();
    setFontReady(true);
    setDraftSettings(null);
    writeReadingPreference("right-to-decide-settings", JSON.stringify(value));
    writeReadingPreference("right-to-decide-font-size", String(value.size));
  }
  function addBookmark() {
    const position = capture();
    const element = document.getElementById(position.blockId);
    if (bookmarks.some(b => b.chapterId === currentId && b.blockId === position.blockId && b.revision === revision)) {
      setNotice("Это место уже в закладках"); return;
    }
    const bookmark: ReaderBookmark = { ...position, id: `${currentId}-${Date.now()}`, chapterId: currentId, title: displayBookTitle(current.title), excerpt: element?.textContent?.trim().slice(0, 150) || displayBookTitle(current.title) };
    writeReadingPreference("right-to-decide-bookmarks", JSON.stringify([bookmark, ...allBookmarks].slice(0, 200)));
    setNotice("Закладка добавлена");
  }
  function openBookmark(bookmark: ReaderBookmark) {
    setPanel(null);
    if (bookmark.chapterId === currentId) {
      window.history.replaceState(null, "", window.location.pathname);
      restore(bookmark);
    } else {
      writeReadingPreference(positionKey(bookmark.chapterId), JSON.stringify(bookmark), false);
      router.push(`/read/${bookmark.chapterId}/`);
    }
  }
  function searchChapter(value: string) {
    setQuery(value);
    const needle = value.trim().toLocaleLowerCase("ru");
    if (!needle) { setResults([]); return; }
    setResults(blocks.current.flatMap(element => {
      const value = element.textContent?.replace(/\s+/g, " ").trim() || "";
      const match = value.toLocaleLowerCase("ru").indexOf(needle);
      if (match < 0) return [];
      const start = Math.max(0, match - 65);
      return [{ id: element.id, excerpt: (start ? "…" : "") + value.slice(start, match + needle.length + 120) + (value.length > match + needle.length + 120 ? "…" : "") }];
    }));
  }
  // A timed-out webfont must not swap in later and move the saved reading position.
  const renderedFont = fontReady ? settings.font : settings.font === "golos" || settings.font === "sans" ? "sans" : "serif";
  const readerStyle = {
    "--reader-size": `${settings.size}px`, "--reader-spacing": settings.spacing,
    "--reader-width": `${{ narrow: 540, normal: 680, wide: 820 }[settings.width]}px`,
    "--reader-font": readerFonts[renderedFont].family,
  } as CSSProperties;
  const percent = Math.round(progress * 100);
  const remaining = Math.max(0, Math.ceil(current.minutes * (1 - progress)));
  return (
    <div className={styles.reader} data-theme={settings.theme} data-font={settings.font} data-focus={focus} style={readerStyle} data-testid="reader">
      <header className={styles.toolbar} data-testid="reader-toolbar" inert={focus}>
        <div className={styles.identity}>
          <Link href="/read/" className={styles.back} aria-label="К книге"><Icon name="back" /><span>К книге</span></Link>
          <span className={styles.divider} />
          <Link href="/" className={styles.bookName}>Право на решение</Link>
        </div>
        <span className={styles.currentTitle}>{displayBookTitle(current.title)}</span>
        <nav className={styles.actions} aria-label="Управление чтением">
          <button onClick={() => setPanel("contents")} aria-label="Содержание" title="Содержание" aria-haspopup="dialog"><Icon name="contents" /></button>
          <button onClick={() => setPanel("search")} aria-label="Поиск по главе" title="Поиск по главе" aria-haspopup="dialog"><Icon name="search" /></button>
          <button onClick={() => setPanel("settings")} aria-label="Настройки чтения" title="Настройки чтения" aria-haspopup="dialog"><span className={styles.aa}>Aa</span></button>
          <button onClick={() => setPanel("bookmarks")} aria-label="Закладки" title="Закладки" aria-haspopup="dialog"><Icon name="bookmark" />{bookmarks.length > 0 && <i className={styles.dot} />}</button>
          <span className={styles.divider} />
          <button onClick={() => setFocus(true)} aria-label="Режим сосредоточенного чтения" title="Скрыть управление"><Icon name="focus" /></button>
        </nav>
      </header>
      {focus && <button className={styles.showControls} onClick={() => setFocus(false)} aria-label="Показать управление"><Icon name="focus" /><span>Показать управление</span></button>}
      <div className={styles.articleColumn} ref={article}>{children}</div>
      <footer className={styles.footer} data-testid="reader-footer" inert={focus}>
        {previous ? <Link href={`/read/${previous.id}/`} className={styles.chapterNav} aria-label="Предыдущий раздел"><Icon name="back" /><span>Предыдущий раздел</span></Link> : <span className={styles.chapterNav} aria-disabled="true"><Icon name="back" /><span>Начало книги</span></span>}
        <div className={styles.progress}>
          <div className={styles.progressLabel}><span>{percent}% главы</span><span>{remaining > 0 ? `Ещё ≈ ${remaining} мин` : "Глава прочитана"}</span></div>
          <input type="range" min="0" max="100" value={percent} aria-label="Прогресс главы" aria-valuetext={`${percent}% главы`} onChange={e => { const value = Number(e.target.value) / 100; window.scrollTo({ top: value * Math.max(0, document.documentElement.scrollHeight - window.innerHeight), behavior: "instant" }); setProgress(value); }} />
        </div>
        {next ? <Link href={`/read/${next.id}/`} className={styles.chapterNav} aria-label="Следующий раздел"><span>Следующий раздел</span><Icon name="next" /></Link> : <Link href="/contents/" className={styles.chapterNav}><span>К содержанию</span><Icon name="next" /></Link>}
      </footer>
      <ReaderPanels panel={panel} onClose={() => setPanel(null)} settings={draftSettings || settings} onSettingsChange={changeSettings} items={items} currentId={currentId} headings={headings} query={query} onQueryChange={searchChapter} results={results} onJump={jump} bookmarks={bookmarks} onBookmarkOpen={openBookmark} onBookmarkRemove={id => writeReadingPreference("right-to-decide-bookmarks", JSON.stringify(allBookmarks.filter(b => b.id !== id)))} onBookmarkAdd={addBookmark} />
      <div role="status" className={notice ? styles.toast : styles.srOnly}>{notice}</div>
    </div>
  );
}
