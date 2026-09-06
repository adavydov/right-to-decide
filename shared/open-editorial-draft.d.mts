import type { EditorialCorpus, EditorialTarget, EditorialEdition, EditorialChapter, EditorialBlock } from "../src/lib/open-editorial";
import type { LocalEditorialDraft } from "../src/lib/open-editorial-local";
export function validateLocalDraftTarget(target: EditorialTarget, corpus: EditorialCorpus): { valid: boolean; error?: string; edition?: EditorialEdition; chapter?: EditorialChapter; block?: EditorialBlock };
export function localDraftJson(draft: LocalEditorialDraft): string;
export function localDraftMarkdown(draft: LocalEditorialDraft): string;
