import { sources, thesisGroups } from "@/data/content";

import styles from "./ThesisSection.module.css";

const sourceById = new Map(sources.map((source) => [source.id, source]));

export function ThesisSection() {
  return (
    <section className={`section-shell ${styles.section}`} id="theses">
      <div className="page-shell">
        <header className="section-intro">
          <p className="section-kicker">02 · Тезисы монографии</p>
          <div className="section-heading">
            <h2>Четырнадцать тезисов, которые книга должна доказать</h2>
            <p>
              Каждый тезис сформулирован как проверяемое утверждение: книга должна
              показать механизм, предъявить доказательства и обозначить границы
              применимости.
            </p>
          </div>
        </header>

        <div className={styles.groups}>
          {thesisGroups.map((group) => (
            <section className={styles.group} key={group.title}>
              <header className={styles.groupHeader}>
                <p className={styles.groupTitle}>{group.title}</p>
                <p className={styles.groupThesis}>{group.thesis}</p>
              </header>

              <ol className={styles.cards}>
                {group.items.map((item) => {
                  const linkedSources = item.sourceIds
                    ?.map((sourceId) => sourceById.get(sourceId))
                    .filter((source) => source !== undefined);

                  return (
                    <li className={styles.card} key={item.number}>
                      <span className={styles.number} aria-hidden="true">
                        {item.number}
                      </span>
                      <h3>{item.title}</h3>
                      <p className={styles.body}>{item.text}</p>

                      {item.consequence ? (
                        <p className={styles.consequence}>{item.consequence}</p>
                      ) : null}

                      {linkedSources?.length ? (
                        <div className={styles.sources} aria-label="Источники">
                          {linkedSources.map((source) => (
                            <a
                              href={source.url}
                              key={source.id}
                              rel="noreferrer"
                              target="_blank"
                              title={source.title}
                            >
                              {source.id}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
