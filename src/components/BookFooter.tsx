import Link from "next/link";
import { assetPath } from "@/lib/site-config";
import styles from "./BookFooter.module.css";
export function BookFooter() {
  return (
    <footer className={styles.footer}>
      <div className="wrap">
        <div className={styles.top}>
          <span className="eyebrow">Футурологический манифест · 2026</span>
          <div className={styles.links}>
            <Link href="/">О книге</Link>
            <Link href="/contents/">Содержание</Link>
            <Link href="/manifesto/">Манифест</Link>
            <Link href="/read/">Читать</Link>
            <Link href="/authors/">Авторы</Link>
            <Link href="/library/">Библиотека</Link>
          </div>
        </div>
        <p className={styles.title}>
          Право на решение<span>↗</span>
        </p>
        <div className={styles.teamLinks}>
          <Link href="/authors/#literary-team">Литературная команда</Link>
          <a href={assetPath("/editorial-team.json")} type="application/json">Авторы и агенты · JSON <span aria-hidden="true">↗</span></a>
        </div>
        <div className={styles.bottom}>
          <span>© А. М. Давыдов, А. А. Давыдов, Е. А. Давыдов</span>
          <span>Как остаться авторами будущего</span>
        </div>
      </div>
    </footer>
  );
}
