import { worldPractices } from "@/data/content";

import styles from "./WorldSection.module.css";

export function WorldSection() {
  return (
    <section className={`section-shell ${styles.section}`} id="world">
      <div className="page-shell">
        <header className="section-intro">
          <p className="section-kicker">05 · Мировая практика</p>
          <div className="section-heading">
            <h2>
              Мир уже создаёт отдельные элементы решения. Целостной архитектуры пока
              не сложилось.
            </h2>
            <p>
              Среди рассмотренных практик не обнаружена широко принятая система,
              соединяющая формирование, независимое доказательство, ограниченное
              полномочие и эксплуатационную обратную связь.
            </p>
          </div>
        </header>

        <ol className={styles.practices}>
          {worldPractices.map((practice) => (
            <li className={styles.practice} key={practice.number}>
              <div className={styles.index} aria-hidden="true">
                <span>{practice.number}</span>
                <span>практика</span>
              </div>

              <article className={styles.content}>
                <h3>{practice.title}</h3>

                <div className={styles.description}>
                  <p>
                    <span className={styles.label}>Механизм</span>
                    {practice.mechanism}
                  </p>
                  <p>
                    <span className={styles.label}>Что уже видно</span>
                    {practice.evidence}
                  </p>
                  <p className={styles.boundary}>
                    <span className={styles.label}>Граница доказательства</span>
                    {practice.boundary}
                  </p>
                </div>

                <div className={styles.links} aria-label="Источники по практике">
                  {practice.links.map((link) => (
                    <a
                      aria-label={`${link.label}, внешний источник`}
                      href={link.url}
                      key={link.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {link.label}
                      <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
