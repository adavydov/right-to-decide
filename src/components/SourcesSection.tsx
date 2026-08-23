import { sources } from "@/data/content";

import styles from "./SourcesSection.module.css";

export function SourcesSection() {
  return (
    <section className={styles.section} id="sources" aria-labelledby="sources-heading">
      <div className="page-shell">
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className="section-kicker">07 · Доказательная дисциплина</p>
            <div>
              <h2 id="sources-heading">
                Сильный тезис обязан показывать границу своего доказательства
              </h2>
              <p>
                На этой странице наблюдаемые эффекты, институциональные практики и
                гипотезы будущей монографии намеренно не смешаны.
              </p>
            </div>
          </header>

          <ol className={styles.list}>
            {sources.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <span className={styles.id}>{source.id}</span>
                  <span className={styles.title}>{source.title}</span>
                  <span className={styles.meta}>
                    <span>{source.organization}</span>
                    <span>{source.boundary}</span>
                  </span>
                  <span className={styles.arrow} aria-hidden="true">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
