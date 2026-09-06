import Link from "next/link";
import styles from "./OpenEditorial.module.css";

export function OpenEditorialModeNotice({ unavailable }: { unavailable?: string }) {
  return <div className={styles.notice}>
    <strong>{unavailable || "Сейчас открытая редакция работает без сервера"}</strong>
    <p>Доступны книга, манифест, личные заметки в браузере и подготовка черновика замечания. Черновик можно скопировать или скачать. Сайт не получает ваши записи и не отправляет их редакции.</p>
    {unavailable && <div className={styles.actions}><Link className="text-link" href="/open-editorial/participate/">Подготовить личный черновик</Link><Link className="text-link" href="/open-editorial/me/">Мои заметки</Link><Link className="text-link" href="/open-editorial/">К открытой редакции</Link></div>}
  </div>;
}
