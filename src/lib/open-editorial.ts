import { editorialConnected } from "./open-editorial-mode";
export { editorialConnected } from "./open-editorial-mode";
export { editorialKinds, editorialDate, safeEditorialUrl, loadEditorialCorpus, editorialBlockTarget, readBrowserNotes, saveBrowserNotes } from "./open-editorial-local";

const configuredEditorialApiRoot = (process.env.NEXT_PUBLIC_EDITORIAL_API_URL || "").trim().replace(/\/$/, "");
export const editorialApiRoot = editorialConnected ? configuredEditorialApiRoot : "";
export const internalEditorialApiRoot = editorialApiRoot.replace(/\/v1$/, "/internal/v1");
export type EditorialTarget = { scope: "book" | "chapter" | "block"; book_id: string; edition_id: string; chapter_id?: string; block_id?: string; block_snapshot_sha256?: string; normalization?: "oe-text-v1"; selector?: { type: "TextQuoteSelector"; exact: string; prefix?: string; suffix?: string; position?: { type: "TextPositionSelector"; start: number; end: number } } };
export type EditorialBlock = { id: string; text: string; normalization: "oe-text-v1"; snapshot_sha256: string; canonical_url: string; selection_supported: boolean };
export type EditorialChapter = { id: string; title: string; canonical_url: string; blocks: EditorialBlock[] };
export type EditorialEdition = { id: string; title: string; published_at: string; chapters: EditorialChapter[] };
export type EditorialCorpus = { book_id: string; current_edition_id?: string; editions: EditorialEdition[] };
export type EditorialMeta = { auth_mode?: string; read_only: boolean; policy_bundle_id: string | null; auth?: { provider_url: string; public_anon_key: string }; capabilities: Record<string, boolean> };
export type EditorialAccount = { id: string; profile: { id: string; display_name: string }; role: string; accepted_policy_bundle_id: string | null; auth_mode: string };
export type EditorialPolicies = { ready: boolean; bundle_id: string | null; items: { title?: string; id?: string; kind?: string; url?: string; canonical_url?: string; version?: string }[]; blockers: string[] };
export type EditorialContribution = { id: string; revision?: number; row_version?: number; kind: string; title?: string; message?: string; created_at?: string; target?: EditorialTarget; editorial_status: string; moderation_status?: string; publication_status?: string; proposed_text?: string; sources?: {url:string;title?:string;relevance?:string;locator?:string}[]; suggested_layer_ids?: string[]; related_task_id?: string; processing_permission?: "human_only" | "editorial_ai"; policy_bundle_id?: string; origin?: { mode: string; assistance_note?: string; model_label?: string }; author?: { display_name?: string }; public_author?: { display_name?: string }; decision?: { rationale?: string; reason?: string }; public_reason?: string; receipt_url?: string; public_url?: string; events?: EditorialEvent[] };
export type EditorialEvent = { id?: string; event_id?: string; created_at?: string; occurred_at?: string; event_type?: string; editorial_status?: string; publication?: { canonical_url?: string; change_summary?: string }; type?: string; status?: string; reason?: string; rationale?: string; message?: string };
export type EditorialNote = { id: string; revision?: number; target: EditorialTarget; message: string; quote?: string; created_at?: string };
export const editorialStatuses: Record<string, string> = { received: "Получено", needs_clarification: "Нужно уточнение", under_review: "Рассматривается", deferred: "Отложено", merged: "Объединено", rejected: "Не принято", accepted: "Принято к изменению", published: "Результат опубликован", withdrawn: "Отозвано" };
export const moderationLabels: Record<string, string> = { pending: "Ожидает модерации", pending_review: "Ожидает модерации", pending_moderation: "Ожидает модерации", visible: "Публично доступно", public: "Публично доступно", approved: "Публично доступно", hidden: "Скрыто модерацией", rejected: "Не прошло модерацию" };
export class EditorialApiError extends Error { constructor(message: string, public code: string, public status: number) { super(message); } }
export async function editorialRequest<T>(path: string, options: { token?: string; method?: string; body?: unknown; idempotencyKey?: string; revision?: number; internal?: boolean } = {}): Promise<T> {
  if (!editorialApiRoot) throw new EditorialApiError("Сервис участия ещё не подключён. Книгу и манифест можно читать, личные заметки — сохранять в этом браузере.", "NOT_CONFIGURED", 0);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = "Bearer " + options.token;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.revision !== undefined) headers["If-Match"] = '"' + options.revision + '"';
  let response: Response;
  try { response = await fetch((options.internal ? internalEditorialApiRoot : editorialApiRoot) + path, { method: options.method || "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(20000) }); }
  catch { throw new EditorialApiError("Нет ответа сервера. Введённый текст сохранён в форме. Повторная отправка использует тот же ключ, чтобы не создать дубль.", "NETWORK_ERROR", 0); }
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new EditorialApiError(data.error?.message || data.message || "Запрос не выполнен (" + response.status + ").", data.error?.code || data.code || "REQUEST_FAILED", response.status);
  return data as T;
}
