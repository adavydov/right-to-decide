import { validateLocalDraftTarget } from './open-editorial-draft.mjs';

/** A retired edition is never selected just because its chapter ID still exists. */
export function currentEditorialEdition(corpus) {
  return corpus?.editions?.find(edition => edition.id === corpus.current_edition_id);
}

export function currentEditorialCorpus(corpus) {
  const current = currentEditorialEdition(corpus);
  if (!current) throw new Error('Текущая редакция книги отсутствует в опубликованном индексе.');
  return { ...corpus, editions: [current] };
}

/** Resolve only against an exact, currently published target; never modify a note. */
export function currentNoteReference(note, corpus) {
  const quote = note.quote || note.target?.selector?.exact || '';
  const edition = currentEditorialEdition(corpus);
  if (!edition || note.target?.edition_id !== edition.id) return { available: false, quote };
  const result = validateLocalDraftTarget(note.target, { ...corpus, editions: [edition] });
  if (!result.valid) return { available: false, quote };
  const url = result.block?.reader_url || result.block?.canonical_url || result.chapter?.reader_url || result.chapter?.canonical_url || edition.canonical_url;
  return { available: true, quote, ...(url ? { url } : {}) };
}

/** Export preserves old edition, block, snapshot and quote even when unavailable. */
export function browserNotesJson(notes) {
  return JSON.stringify({ schema_version: '1.0', storage: 'this-browser-only', notes }, null, 2);
}
