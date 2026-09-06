"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { normalizeText, resolveSelector } from "../../shared/open-editorial-text.mjs";
import { editorialBlockTarget, loadEditorialCorpus, readBrowserNotes, saveBrowserNotes, type EditorialCorpus, type EditorialTarget } from "@/lib/open-editorial-local";
import styles from "./OpenEditorial.module.css";

export function OpenEditorialStaticReader({ chapterId, revision }: { chapterId: string; revision: string }) {
  const [corpus, setCorpus] = useState<EditorialCorpus | null>(null);
  const [target, setTarget] = useState<EditorialTarget | null>(null);
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [opened, setOpened] = useState(false);
  const selection = useRef<{ domId: string; exact: string; fullText: string } | null>(null);
  useEffect(() => {
    const capture = () => {
      const selected = window.getSelection(); if (!selected || selected.isCollapsed || !selected.rangeCount) return;
      const node = selected.anchorNode?.nodeType === Node.ELEMENT_NODE ? selected.anchorNode as Element : selected.anchorNode?.parentElement;
      const end = selected.focusNode?.nodeType === Node.ELEMENT_NODE ? selected.focusNode as Element : selected.focusNode?.parentElement;
      const block = node?.closest<HTMLElement>("[data-reader-block]");
      if (!block || block !== end?.closest("[data-reader-block]")) { selection.current = null; return; }
      selection.current = { domId: block.id, exact: normalizeText(selected.toString()), fullText: normalizeText(block.textContent || "") };
    };
    document.addEventListener("selectionchange", capture);
    return () => document.removeEventListener("selectionchange", capture);
  }, []);
  async function prepare() {
    try {
      const value = corpus || await loadEditorialCorpus(); setCorpus(value);
      const edition = value.editions.find(item => item.id === revision);
      const chapter = edition?.chapters.find(item => item.id === chapterId);
      if (!edition || !chapter) { setTarget(null); setQuote(""); setNotice("Исходная редакция этой главы недоступна в индексе. Привязка к другой версии не перенесена."); return; }
      const captured = selection.current;
      const block = captured ? chapter.blocks.find(item => (item as typeof item & { dom_id?: string }).dom_id === captured.domId || item.id === captured.domId) : undefined;
      if (block) {
        const nextTarget = editorialBlockTarget(value.book_id, edition, chapter, block); let exact = "";
        if (block.selection_supported && captured?.fullText === block.text && captured.exact) {
          try { resolveSelector(block.text, { type: "TextQuoteSelector", exact: captured.exact }); exact = captured.exact; nextTarget.selector = { type: "TextQuoteSelector", exact }; } catch {}
        }
        setTarget(nextTarget); setQuote(exact || block.text);
        setNotice(exact ? "Выделение связано с точным фрагментом опубликованной редакции." : "Используется блок целиком: точность привязки части текста не подтверждена.");
      } else {
        setTarget({ scope: "chapter", book_id: value.book_id, edition_id: edition.id, chapter_id: chapter.id }); setQuote("");
        setNotice("Запись относится к главе целиком. Можно выделить текст и обновить привязку.");
      }
    } catch (err) { setNotice((err as Error).message); }
  }
  const draftUrl = (kind: string) => "/open-editorial/participate/?" + new URLSearchParams({ ...(target ? { edition: target.edition_id, chapter: target.chapter_id || "", ...(target.block_id ? { block: target.block_id } : {}) } : {}), kind }).toString();
  function transfer(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!target) { event.preventDefault(); setNotice("Сначала выберите выделение или главу."); return; }
    if (!target.selector) return;
    try {
      const transferId = crypto.randomUUID();
      sessionStorage.setItem("editorial-target:" + transferId, JSON.stringify({ target, created_at: Date.now() }));
      event.preventDefault(); window.location.assign(event.currentTarget.href + "&transfer=" + encodeURIComponent(transferId));
    } catch { event.preventDefault(); setNotice("Браузер не разрешил передать точное выделение. Выберите блок в форме отдельно."); }
  }
  return <details className={styles.readerEntry} open={opened} onToggle={event => { const open = event.currentTarget.open; setOpened(open); if (open && !target) void prepare(); }}><summary>Личная заметка или черновик замечания</summary><div className={styles.panel}>
    <p>Вы можете спокойно читать без участия. Сайт не отправляет ваши записи редакции: заметки сохраняются в браузере, а отдельный черновик можно скопировать или скачать.</p>
    <div className={styles.actions}><button className={styles.inlineButton} type="button" onClick={() => void prepare()}>Использовать выделение или главу</button><Link className={styles.inlineButton} href="/open-editorial/">Об открытой редакции</Link></div>
    {quote && <blockquote className={styles.quote}>{quote}</blockquote>}<p className={styles.muted} role="status">{notice}</p>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); if (!target) return; try { saveBrowserNotes([{ id: crypto.randomUUID(), target, quote, message: note, created_at: new Date().toISOString() }, ...readBrowserNotes()]); setNote(""); setNotice("Личная заметка сохранена. Только в этом браузере; редакция её не получает."); } catch { setNotice("Браузер не разрешил сохранить заметку. Текст остался в поле."); } }}>
      <label>Личная заметка<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={20000} placeholder="Ваши мысли — только для вас" /></label>
      <button className="button secondary" data-editorial-action="local-notes" disabled={!target || (!note.trim() && !quote)}>Сохранить только в этом браузере</button>
    </form>
    <div className={styles.actions}><Link className="text-link" href={draftUrl("question")} onClick={transfer}>Неясно — подготовить вопрос</Link><Link className="text-link" href={draftUrl("objection")} onClick={transfer}>Подготовить возражение</Link><Link className="text-link" href={draftUrl("suggestion")} onClick={transfer}>Подготовить предложение</Link><Link className="text-link" href="/open-editorial/me/">Мои заметки</Link></div>
    <p className={styles.muted}>Новая форма покажет исходный фрагмент. Черновик остаётся личным и не считается отправленным вкладом.</p>
  </div></details>;
}
