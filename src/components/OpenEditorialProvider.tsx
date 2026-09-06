"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { editorialApiRoot, editorialRequest, type EditorialAccount, type EditorialMeta, type EditorialPolicies } from "@/lib/open-editorial";
import styles from "./OpenEditorial.module.css";
type Context = { meta: EditorialMeta | null; policies: EditorialPolicies | null; account: EditorialAccount | null; token: string; loading: boolean; error: string; connect: (token: string) => Promise<void>; disconnect: () => void; refresh: () => Promise<void> };
const EditorialContext = createContext<Context | null>(null);
export function OpenEditorialProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<EditorialMeta | null>(null);
  const [policies, setPolicies] = useState<EditorialPolicies | null>(null);
  const [account, setAccount] = useState<EditorialAccount | null>(null);
  const [token, setToken] = useState("");
  const [privateGeneration, setPrivateGeneration] = useState(0);
  const authRequest = useRef(0);
  const [loading, setLoading] = useState(Boolean(editorialApiRoot));
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!editorialApiRoot) return;
    const responses = await Promise.allSettled([editorialRequest<EditorialMeta>("/meta"), editorialRequest<EditorialPolicies>("/policies")]);
    if (responses[0].status === "fulfilled") { setMeta(responses[0].value); setError(""); } else setError(responses[0].reason.message);
    if (responses[1].status === "fulfilled") setPolicies(responses[1].value);
    setLoading(false);
  }, []);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  const connect = async (value: string) => { const request = ++authRequest.current; const result = await editorialRequest<EditorialAccount>("/me", { token: value }); if(request !== authRequest.current) return; if(account && account.id !== result.id) setPrivateGeneration(value => value + 1); setAccount(result); setToken(value); };
  const disconnect = () => { authRequest.current++; setPrivateGeneration(value => value + 1); setToken(""); setAccount(null); };
  return <EditorialContext.Provider value={{ meta, policies, account, token, loading, error, connect, disconnect, refresh }}><div key={privateGeneration}>{children}</div></EditorialContext.Provider>;
}
export function useEditorial() { const value = useContext(EditorialContext); if (!value) throw new Error("Editorial context missing"); return value; }
export function OpenEditorialReadiness() {
  const { meta, loading, error } = useEditorial();
  if (loading) return <div className={styles.notice} role="status">Проверяем доступность сервиса участия…</div>;
  if (meta && !meta.read_only && meta.capabilities.submit_contribution) return <div className={styles.notice}><strong>Приём предложений открыт</strong>После отправки появятся номер и история рассмотрения. Сохранение не означает принятие правки.</div>;
  return <div className={styles.notice}><strong>Чтение открыто. Публичный приём пока закрыт.</strong>{error ? "Сервис участия сейчас недоступен. " : ""}Для открытия нужны опубликованные условия использования материалов, приватности, модерации и обжалования, а также подтверждённый вход. Личные заметки доступны в этом браузере.</div>;
}
export function OpenEditorialLogin() {
  const { account, meta, connect, disconnect } = useEditorial();
  const [value, setValue] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  if (account) return <div className={styles.toolbar}><p>Вы вошли как <strong>{account.profile.display_name}</strong><span className={styles.muted}> · {account.auth_mode === "local-development" ? "локальная проверка" : "подтверждённый вход"}</span></p><button type="button" className="button secondary" onClick={disconnect}>Выйти</button></div>;
  if (meta?.auth_mode === "supabase" && meta.auth) return <OpenEditorialEmailLogin providerUrl={meta.auth.provider_url} publicKey={meta.auth.public_anon_key} />;
  if (!editorialApiRoot || meta?.auth_mode !== "local-development") return <div className={styles.notice}><strong>Вход участников ещё не подключён</strong>Публичная регистрация откроется после настройки подтверждения учётной записи и утверждения правил.</div>;
  return <details className={styles.panel}><summary>Локальная проверка — вход участника команды</summary><form className={styles.form} onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await connect(value.trim()); setValue(""); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}><p className={styles.muted}>Введите токен, выданный локальным инструментом проекта. Он остаётся только в памяти этой вкладки и исчезает при обновлении страницы. Это технический режим проверки; публичный вход по email ещё не настроен.</p><label>Токен локальной сессии<input type="password" autoComplete="off" value={value} onChange={e => setValue(e.target.value)} required /></label><button className="button" disabled={busy}>{busy ? "Проверяем…" : "Войти в локальную сессию"}</button>{error && <p role="alert" className={styles.error}>{error}</p>}</form></details>;
}

function OpenEditorialEmailLogin({providerUrl,publicKey}:{providerUrl:string;publicKey:string}) {
 const {connect}=useEditorial();const [email,setEmail]=useState("");const [code,setCode]=useState("");const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{const hash=new URLSearchParams(window.location.hash.slice(1));const accessToken=hash.get("access_token");if(!accessToken)return;window.history.replaceState(null,"",window.location.pathname+window.location.search);void connect(accessToken).catch(err=>setError(err.message));},[connect]);
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError("");try{const url=new URL(providerUrl);if(url.protocol!=="https:")throw new Error("Для подтверждённого входа нужен HTTPS-провайдер.");const endpoint=sent?"/auth/v1/verify":"/auth/v1/otp?redirect_to="+encodeURIComponent(window.location.href.split("#")[0]);const response=await fetch(url.origin+endpoint,{method:"POST",headers:{"Content-Type":"application/json",apikey:publicKey},body:JSON.stringify(sent?{email,token:code,type:"email"}:{email,create_user:true}),credentials:"omit",signal:AbortSignal.timeout(20000)});const value=await response.json();if(!response.ok)throw new Error(value.msg||value.error_description||"Не удалось подтвердить email.");if(sent){if(!value.access_token)throw new Error("Провайдер не вернул подтверждённую сессию.");await connect(value.access_token);setCode("");}else setSent(true);}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 return <section className={styles.panel}><h2>Войти по email</h2><form className={styles.form} onSubmit={submit}><label>Email — не публикуется<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required disabled={sent}/></label>{sent?<><p className={styles.muted}>Проверьте письмо провайдера входа. Откройте ссылку или введите код, если он есть в письме. Email не становится публичным именем.</p><label>Код из письма<input value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required maxLength={12}/></label></>:<p className={styles.muted}>Нажатие отправит письмо через настроенного провайдера входа. Условия использования вкладов принимаются отдельно перед отправкой материала.</p>}<button className="button" disabled={busy}>{busy?"Ожидаем ответ…":sent?"Подтвердить код":"Получить письмо для входа"}</button>{sent&&<button className="button secondary" type="button" onClick={()=>{setSent(false);setCode("");}}>Указать другой email</button>}{error&&<p className={styles.error} role="alert">{error}</p>}</form></section>;
}
