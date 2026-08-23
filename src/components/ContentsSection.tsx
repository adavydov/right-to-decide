import { bookParts } from "@/data/content";

import styles from "./ContentsSection.module.css";

export function ContentsSection() {
  return (
    <section className={`section-shell ${styles.section}`} id="contents">
      <div className="page-shell">
        <header className="section-intro">
          <p className="section-kicker">04 · Содержание монографии</p>
          <div className="section-heading">
            <h2>Шесть частей. Восемнадцать глав. Один вопрос о доверии.</h2>
          </div>
        </header>

        <div className={styles.parts}>
          {bookParts.map((part, index) => (
            <details className={styles.part} key={part.number} open={index === 0}>
              <summary className={styles.summary}>
                <span className={styles.number} aria-hidden="true">
                  {part.number}
                </span>
                <span className={styles.title}>{part.title}</span>
                <span className={styles.thesis}>{part.thesis}</span>
                <span className={styles.toggle} aria-hidden="true">
                  +
                </span>
              </summary>

              <ol className={styles.chapters}>
                {part.chapters.map((chapter) => (
                  <li key={chapter}>{chapter}</li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
