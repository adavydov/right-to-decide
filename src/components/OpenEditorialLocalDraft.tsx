"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resolveSelector } from "../../shared/open-editorial-text.mjs";
import { editorialBlockTarget, editorialKinds, loadEditorialCorpus, safeEditorialUrl, type EditorialCorpus, type EditorialTarget } from "@/lib/open-editorial-local";
import { downloadLocalEditorialFile, localDraftMarkdown, localDraftJson, validateLocalDraftTarget, type LocalEditorialDraft } from "@/lib/open-editorial-local";
import { OpenEditorialModeNotice } from "./OpenEditorialModeNotice";
import styles from "./OpenEditorial.module.css";

export function OpenEditorialLocalDraft() {
  const search = useSearchParams();
  const [corpus, setCorpus] = useState<EditorialCorpus | null>(null);
  const [editionId, setEditionId] = useState(search.get("edition") || "");
  const [chapterId, setChapterId] = useState(search.get("chapter") || "");
  const [blockId, setBlockId] = useState(search.get("block") || "");
  const [kind, setKind] = useState(editorialKinds[search.get("kind") || ""] ? search.get("kind")! : "question");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [proposed, setProposed] = useState("");
  const [source, setSource] = useState("");
  const [locator, setLocator] = useState("");
  const [origin, setOrigin] = useState<"human" | "ai_assisted">("human");
  const [assistance, setAssistance] = useState("");
  const [selectionTarget, setSelectionTarget] = useState<EditorialTarget | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [manualCopy, setManualCopy] = useState("");

  useEffect(() => {
    let active = true;
    loadEditorialCorpus().then(value => { if (active) { setCorpus(value); if (!search.get("edition") && !search.get("transfer") && !search.get("note_draft")) setEditionId(value.editions.find(edition => edition.id === value.current_edition_id)?.id || value.editions[0]?.id || ""); } }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [search]);
  useEffect(() => {
    const transferId = search.get("transfer");
    const noteTransfer = search.get("note_draft");
    if (!transferId && !noteTransfer) return;
    try {
      const raw = sessionStorage.getItem((noteTransfer ? "editorial-note-draft:" : "editorial-target:") + (noteTransfer || transferId));
      if (!raw) throw new Error("Переданный фрагмент недоступен. Выберите место в книге заново.");
      const value = JSON.parse(raw);
      if (!value.target || typeof value.created_at !== "number" || Date.now() - value.created_at > 3600000) throw new Error("Срок передачи фрагмента истёк. Выберите место в книге заново.");
      Promise.resolve().then(() => {
        setSelectionTarget(value.target);
        setEditionId(value.target.edition_id); setChapterId(value.target.chapter_id || ""); setBlockId(value.target.block_id || "");
        if (noteTransfer && typeof value.message === "string") setMessage(value.message);
      });
    } catch (err) { Promise.resolve().then(() => setSelectionError((err as Error).message)); }
  }, [search]);

  const edition = corpus?.editions.find(value => value.id === editionId);
  const chapter = edition?.chapters.find(value => value.id === chapterId);
  const block = chapter?.blocks.find(value => value.id === blockId);
  const target: EditorialTarget | undefined = corpus && edition ? block && chapter ? editorialBlockTarget(corpus.book_id, edition, chapter, block) : { scope: chapter ? "chapter" : "book", book_id: corpus.book_id, edition_id: edition.id, ...(chapter ? { chapter_id: chapter.id } : {}) } : undefined;
  let targetError = selectionError;
  if (selectionTarget && target) {
    if (selectionTarget.book_id !== target.book_id || selectionTarget.edition_id !== target.edition_id || selectionTarget.chapter_id !== target.chapter_id || selectionTarget.block_id !== target.block_id || selectionTarget.block_snapshot_sha256 !== target.block_snapshot_sha256) targetError = "Переданное замечание относится к другому снимку. Выберите исходную область заново.";
    else if (selectionTarget.selector) {
      if (!block || !block.selection_supported) targetError = "Для этого блока доступно замечание целиком. Выберите его заново.";
      else try { resolveSelector(block.text, selectionTarget.selector); target.selector = selectionTarget.selector; } catch { targetError = "Точная цитата не совпадает с каноническим блоком. Привязка не переносится автоматически."; }
    }
  }
  if (corpus && (!edition || (chapterId && !chapter) || (blockId && !block))) targetError = "Исходная редакция или фрагмент не найдены. Выберите область заново.";
  if (target && corpus) { const validation = validateLocalDraftTarget(target, corpus); if (!validation.valid) targetError = "Привязка не прошла проверку по исходной книге (" + validation.error + "). Выберите фрагмент заново."; }
  const quote = target?.selector?.exact || block?.text || "";
  const sourceValid = !source || Boolean(safeEditorialUrl(source)?.startsWith("http"));
  const ready = Boolean(target && !targetError && sourceValid && message.trim());

  function clearTransfer() { setSelectionTarget(null); setSelectionError(""); }
  function draft(): LocalEditorialDraft | null {
    if (!ready || !target || !edition) return null;
    return { draft_schema_version: "1.0", state: "local_draft", created_at: new Date().toISOString(), target, edition_title: edition.title, ...(chapter ? { chapter_title: chapter.title } : {}), ...(block?.canonical_url || chapter?.canonical_url ? { canonical_url: block?.canonical_url || chapter?.canonical_url } : {}), ...(quote ? { quote } : {}), kind, message: message.trim(), ...(title.trim() ? { title: title.trim() } : {}), ...(proposed.trim() ? { proposed_text: proposed.trim() } : {}), ...(source ? { sources: [{ url: source, ...(locator ? { locator } : {}) }] } : {}), origin: { mode: origin, ...(origin === "ai_assisted" && assistance ? { assistance_note: assistance } : {}) } };
  }
  async function copy() {
    const value = draft(); if (!value) return;
    const text = localDraftMarkdown(value);
    try { await navigator.clipboard.writeText(text); setNotice("Личный черновик скопирован. Он не отправлен редакции."); setManualCopy(""); }
    catch { setManualCopy(text); setNotice("Браузер не разрешил копирование. Выделите текст в поле ниже и скопируйте вручную."); }
  }
  function download(format: "markdown" | "json") {
    const value = draft(); if (!value) return;
    try {
      downloadLocalEditorialFile(format === "json" ? localDraftJson(value) : localDraftMarkdown(value), "editorial-draft." + (format === "json" ? "json" : "md"), format === "json" ? "application/json" : "text/markdown;charset=utf-8");
      setNotice("Файл подготовлен для скачивания. Проверьте загрузки браузера. Черновик не отправлен редакции.");
    } catch { setNotice("Не удалось подготовить файл. Текст остался в форме; можно скопировать его или повторить скачивание."); }
  }

  return <><OpenEditorialModeNotice /><form className={styles.form} onSubmit={event => { event.preventDefault(); void copy(); }}>
    <fieldset><legend>Привязка к опубликованному тексту</legend>
      <label>Редакция<select value={editionId} onChange={e => { setEditionId(e.target.value); setChapterId(""); setBlockId(""); clearTransfer(); }}><option value="">Выберите редакцию</option>{corpus?.editions.map(value => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label>
      <label>Область замечания<select value={chapterId} onChange={e => { setChapterId(e.target.value); setBlockId(""); clearTransfer(); }}><option value="">Книга целиком</option>{edition?.chapters.map(value => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label>
      {chapter && <label>Фрагмент<select value={blockId} onChange={e => { setBlockId(e.target.value); clearTransfer(); }}><option value="">Глава целиком</option>{chapter.blocks.map((value, index) => <option key={value.id} value={value.id}>{index + 1}. {value.text.slice(0, 100)}</option>)}</select></label>}
      {quote && <><blockquote className={styles.quote}>{quote}</blockquote><p className={styles.muted}>{target?.selector ? "Точное выделение проверено по каноническому тексту." : "Выбран блок целиком."} Черновик сохраняет исходную версию и хеш блока.</p></>}
      {targetError && <p className={styles.error} role="alert">{targetError}</p>}
    </fieldset>
    <label>Тип замечания<select value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(editorialKinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Ваше замечание<textarea required maxLength={12000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Что здесь неясно, чего не хватает или что стоит проверить?" /></label>
    <details><summary className={styles.inlineButton}>Заголовок, вариант и источник — по желанию</summary><div className={styles.form}>
      <label>Заголовок<input maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Предлагаемый вариант<textarea maxLength={20000} value={proposed} onChange={e => setProposed(e.target.value)} /></label>
      <label>Источник<input type="url" value={source} onChange={e => setSource(e.target.value)} placeholder="https://" /></label>
      <label>Точный фрагмент источника<input value={locator} onChange={e => setLocator(e.target.value)} placeholder="Страница, раздел или временная отметка" /></label>
      {!sourceValid && <p className={styles.error}>Нужна ссылка HTTP или HTTPS без логина и пароля.</p>}
    </div></details>
    <label>Как подготовлен черновик<select value={origin} onChange={e => setOrigin(e.target.value as "human" | "ai_assisted")}><option value="human">Самостоятельно</option><option value="ai_assisted">С помощью ИИ</option></select></label>
    {origin === "ai_assisted" && <label>В чём помог ИИ<input value={assistance} onChange={e => setAssistance(e.target.value)} maxLength={2000} /></label>}
    <div className={styles.notice}><strong>Сохранение в ваших руках</strong>Автосохранения черновика нет: текст находится только в памяти открытой страницы. Перед обновлением или закрытием скопируйте либо скачайте его и проверьте результат. Сайт не отправляет черновики и не принимает согласия на будущую публикацию.</div>
    <div className={styles.actions}><button className="button" type="submit" data-editorial-action="draft-copy" disabled={!ready}>Скопировать черновик</button><button className="button secondary" type="button" data-editorial-action="draft-download" disabled={!ready} onClick={() => download("markdown")}>Скачать Markdown</button><button className="button secondary" type="button" data-editorial-action="draft-download" disabled={!ready} onClick={() => download("json")}>Скачать JSON с привязкой</button></div>
    {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || notice}</p>}
    {manualCopy && <label>Черновик для ручного копирования<textarea value={manualCopy} readOnly onFocus={e => e.currentTarget.select()} /></label>}
    <Link className="text-link" href="/open-editorial/me/">Личные заметки в этом браузере</Link>
  </form></>;
}
