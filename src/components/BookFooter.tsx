import Link from "next/link";
import styles from "./BookFooter.module.css";
export function BookFooter() {
  return (
    <footer className={styles.footer}>
      <div className="wrap">
        <div className={styles.top}>
          <span className="eyebrow">Монография · 2026</span>
          <div className={styles.links}>
            <Link href="/">О книге</Link>
            <Link href="/contents/">Содержание</Link>
            <Link href="/read/">Читать</Link>
            <Link href="/authors/">Авторы</Link>
          </div>
        </div>
        <p className={styles.title}>
          Право на решение<span>↗</span>
        </p>
        <div className={styles.bottom}>
          <span>© А. М. Давыдов, А. А. Давыдов, Е. А. Давыдов</span>
          <span>Инженерное образование в эпоху ИИ</span>
        </div>
      </div>
    </footer>
  );
}
