import type { EditorialCorpus, EditorialEdition, EditorialNote } from '../src/lib/open-editorial';
export function currentEditorialEdition(corpus?: EditorialCorpus | null): EditorialEdition | undefined;
export function currentEditorialCorpus(corpus: EditorialCorpus): EditorialCorpus;
export function currentNoteReference(note: EditorialNote, corpus?: EditorialCorpus | null): { available: boolean; quote: string; url?: string };
export function browserNotesJson(notes: EditorialNote[]): string;
