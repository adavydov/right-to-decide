"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { assetPath } from "@/lib/site-config";
import { editorialDate, readBrowserNotes, saveBrowserNotes, type EditorialNote } from "@/lib/open-editorial-local";
import { downloadLocalEditorialFile } from "@/lib/open-editorial-local";
import styles from "./OpenEditorial.module.css";

export function OpenEditorialLocalNotes() {
  const [notes, setNotes] = useState<EditorialNote[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => { const update = () => setNotes(readBrowserNotes()); update(); window.addEventListener("editorial-notes", update); return () => window.removeEventListener("editorial-notes", update); }, []);
  function remove(id: string) { try { saveBrowserNotes(readBrowserNotes().filter(note => note.id !== id)); setNotice("Заметка удалена из этого браузера."); } catch { setNotice("Браузер не разрешил удалить заметку."); } }
  function edit(id: string, message: string) { try { saveBrowserNotes(readBrowserNotes().map(note => note.id === id ? { ...note, message } : note)); setNotice("Личная заметка обновлена только в этом браузере."); } catch { setNotice("Браузер не разрешил сохранить изменение."); } }
  function createDraft(note: EditorialNote) {
    try { const transfer = crypto.randomUUID(); sessionStorage.setItem("editorial-note-draft:" + transfer, JSON.stringify({ target: note.target, message: note.message, created_at: Date.now() })); window.location.assign(assetPath("/open-editorial/participate/?note_draft=" + encodeURIComponent(transfer))); }
    catch { setNotice("Браузер не разрешил перенести заметку в отдельный черновик. Скопируйте её текст вручную."); }
  }
  return <div data-editorial-action="local-notes"><div className={styles.notice}><strong>Только в этом браузере</strong>Заметки хранятся в текущем профиле браузера. Сайт и редакция их не получают. Другой человек с доступом к этому профилю может их прочитать; очистка данных браузера может их удалить.</div>
    {notes.length ? <>{notes.map(note => <article key={note.id} className={styles.card}>
      {note.quote && <blockquote className={styles.quote}>{note.quote}</blockquote>}<p className={styles.message}>{note.message}</p><p className={styles.meta}>{editorialDate(note.created_at)} · {note.target.chapter_id || "Книга целиком"}</p><p className={styles.mono}>{note.target.edition_id}</p>
      <details><summary className={styles.inlineButton}>Изменить личную заметку</summary><form className={styles.form} onSubmit={event => { event.preventDefault(); edit(note.id, event.currentTarget.querySelector("textarea")?.value || ""); }}><label>Текст для себя<textarea defaultValue={note.message} maxLength={20000} /></label><button className="button secondary">Сохранить в браузере</button></form></details>
      <div className={styles.actions}><button className={styles.inlineButton} onClick={() => createDraft(note)}>Сделать отдельный черновик из заметки</button><button className={styles.inlineButton} onClick={() => remove(note.id)}>Удалить с этого устройства</button></div><p className={styles.muted}>Черновик откроется только у вас. Он не отправляется редакции и не делает заметку публичной.</p>
    </article>)}<div className={styles.actions}><button className="button secondary" onClick={() => { try { downloadLocalEditorialFile(JSON.stringify({ schema_version: "1.0", storage: "this-browser-only", notes }, null, 2), "private-reading-notes.json", "application/json"); setNotice("Файл с личными заметками подготовлен для скачивания. Проверьте загрузки браузера."); } catch { setNotice("Не удалось подготовить файл. Личные заметки остаются в этом браузере; попробуйте ещё раз."); } }}>Скачать все личные заметки</button></div></> : <div className={styles.empty}><h2>Заметок пока нет</h2><p>Откройте главу и выберите «Личная заметка или черновик замечания». Можно сохранить точное выделение или мысль о главе целиком.</p></div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}<div className={styles.actions}><Link className="button" href="/read/">Читать книгу</Link><Link className="text-link" href="/open-editorial/participate/">Подготовить черновик</Link></div>
  </div>;
}
