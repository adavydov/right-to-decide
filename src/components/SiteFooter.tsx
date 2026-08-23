import styles from "./SiteFooter.module.css";

const sectionLinks = [
  { href: "#problem", label: "Проблема" },
  { href: "#theses", label: "Тезисы" },
  { href: "#framework", label: "Формула книги" },
  { href: "#contents", label: "Содержание" },
  { href: "#world", label: "Мировой опыт" },
  { href: "#novelty", label: "Научная новизна" },
  { href: "#sources", label: "Источники" },
  { href: "#author", label: "Об авторе" },
] as const;

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.identity}>
          <a className={styles.brand} href="#">
            Право на решение
          </a>
          <p className={styles.subtitle}>
            Инженерное образование как система когнитивного допуска в эпоху
            искусственного интеллекта
          </p>
          <p className={styles.status}>Публичный проспект · книга в работе</p>
          <p className={styles.copyright}>© 2026 Алексей Михайлович Давыдов</p>
        </div>

        <nav className={styles.linkGroup} aria-label="Разделы сайта">
          <p className={styles.groupTitle}>Разделы</p>
          <ul>
            {sectionLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.linkGroup}>
          <p className={styles.groupTitle}>Проект</p>
          <ul>
            <li>
              <a
                href="https://github.com/adavydov/right-to-decide"
                target="_blank"
                rel="noreferrer"
              >
                GitHub ↗
              </a>
            </li>
            <li>
              <a href="mailto:letterdam@mail.ru">Написать автору</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
