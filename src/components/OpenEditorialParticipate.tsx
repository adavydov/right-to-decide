"use client";
import Link from "next/link";
import { resolveSelector } from "../../shared/open-editorial-text.mjs";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { editorialBlockTarget, editorialKinds, editorialRequest, editorialStatuses, loadEditorialCorpus, safeEditorialUrl, type EditorialContribution, type EditorialCorpus, type EditorialTarget } from "@/lib/open-editorial";
import { OpenEditorialLogin, OpenEditorialReadiness, useEditorial } from "./OpenEditorialProvider";
import styles from "./OpenEditorial.module.css";

export function OpenEditorialParticipate() {
  const search = useSearchParams();
  const { meta, policies, account, token, connect } = useEditorial();
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
  const [origin, setOrigin] = useState("human");
  const [assistance, setAssistance] = useState("");
  const [processing, setProcessing] = useState("human_only");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectionTarget, setSelectionTarget] = useState<EditorialTarget | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const [mark, setMark] = useState("");
  const [markNotice, setMarkNotice] = useState("");
  const [receipt, setReceipt] = useState<EditorialContribution | null>(null);
  const attempt = useRef<{ key: string; body: string } | null>(null);
  useEffect(() => { let active = true; loadEditorialCorpus().then(value => { if (active) { setCorpus(value); if (!search.get("edition")) setEditionId(value.editions[0]?.id || ""); } }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, [search]);
  useEffect(() => { const transferId = search.get("transfer"); if (!transferId) return; try { const raw = sessionStorage.getItem("editorial-target:" + transferId); if (!raw) throw new Error("Переданное выделение недоступно. Выберите блок заново."); const value = JSON.parse(raw); if (!value.target?.selector || typeof value.created_at !== "number" || Date.now() - value.created_at > 3600000) throw new Error("Срок передачи выделения истёк. Выберите фрагмент заново."); Promise.resolve().then(() => setSelectionTarget(value.target)); } catch (err) { Promise.resolve().then(() => setSelectionError((err as Error).message)); } }, [search]);
  useEffect(() => { let active = true; if (!token) return; editorialRequest<{items:{id:string;target:EditorialTarget}[]}>("/me/strong-marks",{token}).then(result => { if(active) setMark(result.items.find(item => item.target.edition_id === editionId && (item.target.chapter_id||"") === chapterId && (item.target.block_id||"") === blockId)?.id || ""); }).catch(() => { if(active) setMark(""); }); return () => { active = false; }; }, [token,editionId,chapterId,blockId]);
  const edition = corpus?.editions.find(item => item.id === editionId);
  const chapter = edition?.chapters.find(item => item.id === chapterId);
  const block = chapter?.blocks.find(item => item.id === blockId);
  const target: EditorialTarget | undefined = corpus && edition ? block && chapter ? editorialBlockTarget(corpus.book_id, edition, chapter, block) : { scope: chapter ? "chapter" : "book", book_id: corpus.book_id, edition_id: edition.id, ...(chapter ? { chapter_id: chapter.id } : {}) } : undefined;
  let exactError = selectionError;
  if (selectionTarget && target && block) {
    if (selectionTarget.edition_id !== target.edition_id || selectionTarget.block_id !== target.block_id || selectionTarget.block_snapshot_sha256 !== target.block_snapshot_sha256) exactError = "Выделение относится к другому снимку. Выберите область заново.";
    else { try { resolveSelector(block.text, selectionTarget.selector!); target.selector = selectionTarget.selector; } catch { exactError = "Точное выделение не совпадает с опубликованным блоком. Отправка остановлена."; } }
  }
  const targetInvalid = Boolean((chapterId && !chapter) || (blockId && !block) || exactError);
  const ready = Boolean(meta?.capabilities.submit_contribution && !meta.read_only && policies?.ready && policies.bundle_id);
  const canSend = ready && account && target && !targetInvalid && message.trim() && consent && !busy;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!canSend || !policies?.bundle_id) return;
    setBusy(true); setError("");
    try {
      if (account) { await editorialRequest("/me/consents", { method: "POST", token, body: { policy_bundle_id: policies.bundle_id, processing_permission: processing } }); await connect(token); }
      const body = { schema_version: "1.0", kind, target, message: message.trim(), ...(title.trim() ? { title: title.trim() } : {}), ...(proposed.trim() ? { proposed_text: proposed.trim() } : {}), ...(source ? { sources: [{ url: source, ...(locator ? { locator } : {}) }] } : {}), origin: { mode: origin, ...(assistance ? { assistance_note: assistance } : {}) }, processing_permission: processing, policy_bundle_id: policies.bundle_id };
      const serialized = JSON.stringify(body);
      if (!attempt.current || attempt.current.body !== serialized) attempt.current = { key: crypto.randomUUID(), body: serialized };
      setReceipt(await editorialRequest<EditorialContribution>("/contributions", { method: "POST", token, body, idempotencyKey: attempt.current.key }));
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  if (receipt) return <div className={styles.success} role="status"><h2>Предложение сохранено</h2><p>Номер: <strong>{receipt.id}</strong>. {editorialStatuses[receipt.editorial_status] || receipt.editorial_status}.</p><p>Получение не означает рецензирование или публикацию. История и редакционное решение появятся в карточке.</p><div className={styles.actions}><Link className="button" href={"/open-editorial/contribution/?id=" + encodeURIComponent(receipt.id) + "&owner=1"}>Открыть подтверждение</Link></div><p className={styles.muted}>Редакция: {edition?.title || target?.edition_id}</p></div>;
  async function toggleMark() { if (!target || !account || !policies?.bundle_id || !consent || !ready) return; setBusy(true); setError(""); try { await editorialRequest("/me/consents", { method: "POST", token, body: { policy_bundle_id: policies.bundle_id, processing_permission: processing } }); await connect(token); if (mark) { await editorialRequest("/strong-marks/" + encodeURIComponent(mark), { method: "DELETE", token }); setMark(""); setMarkNotice("Публичная отметка снята."); } else { const wholeBlock = { ...target }; delete wholeBlock.selector; const saved = await editorialRequest<{id:string}>("/strong-marks", { method: "POST", token, body: { target: wholeBlock } }); setMark(saved.id); setMarkNotice("Публичная отметка сохранена. Это читательский отклик, а не редакционный голос."); } } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <><OpenEditorialReadiness /><OpenEditorialLogin /><form className={styles.form} onSubmit={submit}>
    <fieldset><legend>К какому месту относится замечание</legend><label>Редакция книги<select value={editionId} onChange={e => { setEditionId(e.target.value); setChapterId(""); setBlockId(""); setSelectionTarget(null); setSelectionError(""); }}><option value="">Выберите редакцию</option>{corpus?.editions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Область замечания<select value={chapterId} onChange={e => { setChapterId(e.target.value); setBlockId(""); setSelectionTarget(null); setSelectionError(""); }}><option value="">Книга целиком</option>{edition?.chapters.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{chapter && <label>Фрагмент<select value={blockId} onChange={e => { setBlockId(e.target.value); setSelectionTarget(null); setSelectionError(""); }}><option value="">Глава целиком</option>{chapter.blocks.map((item,index) => <option key={item.id} value={item.id}>{index + 1}. {item.text.slice(0,95)}</option>)}</select></label>}{block && <><blockquote className={styles.quote}>{target?.selector?.exact || block.text}</blockquote><p className={styles.muted}>{target?.selector ? "Точное выделение в указанной редакции. Сервер повторно проверит цитату и хеш." : "Привязка к блоку целиком в указанной редакции."} После изменения книги исходная привязка сохранится.</p></>}{targetInvalid && <p className={styles.error}>{exactError || "Исходный фрагмент не найден в выбранной редакции. Выберите цель заново; привязка не переносится автоматически."}</p>}</fieldset>
    <label>Тип замечания<select value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(editorialKinds).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Ваше замечание<textarea required maxLength={12000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Можно начать с точного «здесь я перестал понимать»." /></label>
    <details><summary className={styles.inlineButton}>Добавить заголовок, вариант или источник</summary><div className={styles.form}><label>Заголовок — необязательно<input maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label><label>Предлагаемая формулировка<textarea maxLength={20000} value={proposed} onChange={e => setProposed(e.target.value)} /></label><label>Ссылка на источник<input type="url" value={source} onChange={e => setSource(e.target.value)} placeholder="https://" /></label><label>Точный фрагмент источника<input value={locator} onChange={e => setLocator(e.target.value)} placeholder="Страница, раздел, таблица или временная отметка" /></label></div></details>
    <fieldset><legend>Происхождение и публичность</legend><label>Как подготовлено замечание<select value={origin} onChange={e => setOrigin(e.target.value)}><option value="human">Самостоятельно</option><option value="ai_assisted">С помощью ИИ</option></select></label>{origin === "ai_assisted" && <label>В чём помог ИИ<input value={assistance} onChange={e => setAssistance(e.target.value)} maxLength={2000} /></label>}<p className={styles.muted}>После модерации текст замечания, фрагмент книги, псевдоним и происхождение могут стать публичными. Псевдоним: <strong>{account?.profile.display_name || "появится после входа"}</strong>. Включение в книгу, оплата и соавторство не гарантируются.</p><label>Разрешённая внутренняя обработка<select value={processing} onChange={e => setProcessing(e.target.value)}><option value="human_only">Только людьми редакции</option><option value="editorial_ai" disabled={!meta?.capabilities.editorial_ai_processing}>Людьми и ИИ редакции — после утверждения условий</option></select></label><p className={styles.muted}>Это разрешение касается внутренних процессов редакции. Оно не управляет тем, кто прочитает уже публичное замечание в интернете.</p></fieldset>
    <fieldset><legend>Условия отправки</legend>{policies?.ready ? <><p className={styles.muted}>Пакет правил: {policies.bundle_id}</p>{policies.items.map((item,index) => <a key={item.id || item.kind || index} className="text-link" href={safeEditorialUrl(item.canonical_url || item.url)}>{item.title || item.kind || item.id} · {item.version}</a>)}</> : <p className={styles.muted}>Условия использования материалов и связанные политики ещё не утверждены. Принять их и отправить публичный вклад пока нельзя.</p>}<label className={styles.check}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={!ready} /><span>Я прочитал опубликованные условия, принимаю указанный пакет правил и разрешаю выбранную внутреннюю обработку. Это отдельное согласие для моего вклада.</span></label><Link className="text-link" href="/open-editorial/rules/">Правила и статус их утверждения</Link></fieldset>
    <fieldset><legend>Отдельный публичный отклик</legend><p className={styles.muted}>Можно отметить блок как сильное место. Отметка публична и не влияет на принятие правки. Текст замечания для неё не требуется.</p><button type="button" className="button secondary" disabled={!ready || !account || !target || targetInvalid || !consent || busy} onClick={() => void toggleMark()}>{mark ? "Снять мою публичную отметку" : "Публично отметить сильное место"}</button>{markNotice && <p role="status" className={styles.muted}>{markNotice}</p>}</fieldset>
    {error && <p className={styles.error} role="alert">{error}</p>}<button type="submit" className="button" disabled={!canSend}>{busy ? "Сохраняем на сервере…" : !ready ? "Публичный приём пока закрыт" : !account ? "Для отправки нужно войти" : "Отправить на рассмотрение"}</button><p className={styles.muted}>Черновик остаётся в форме до закрытия страницы. Успешная отправка всегда подтверждается сервером и номером.</p>
  </form></>;
}
