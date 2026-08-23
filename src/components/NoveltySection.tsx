import { notNovel, noveltyItems } from "@/data/content";

import styles from "./NoveltySection.module.css";

export function NoveltySection() {
  return (
    <section className={`section-shell ${styles.section}`} id="novelty">
      <div className="page-shell">
        <header className="section-intro">
          <p className="section-kicker">06 · Научная новизна</p>
          <div className="section-heading">
            <h2>
              Новизна находится в причинной сборке, а не в перечне модных практик
            </h2>
            <p>
              Книга соединяет разрыв формирования, разрыв доверия и распределённое
              право на действие в одну проверяемую модель инженерного образования.
            </p>
          </div>
        </header>

        <p className={styles.lead}>
          Новый курс по ИИ не решит проблему. Если оставить прежними ученичество,
          оценивание и основания допуска, университет лишь ускорит производство
          недоказанной компетентности.
        </p>

        <ol className={styles.grid}>
          {noveltyItems.map((item) => (
            <li className={styles.card} key={item.number}>
              <span className={styles.number} aria-hidden="true">
                {item.number}
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>

        <div className={styles.priorArt}>
          <p className={styles.priorArtTitle}>Что само по себе не является новизной</p>
          <div className={styles.chips} aria-label="Известные практики">
            {notNovel.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <p className={styles.caveat}>
          Это заявка на проверяемую теорию изменения, а не декларация доказанного
          превосходства. Монографии потребуются систематический анализ
          предшествующих работ, экспериментальные внедрения, независимые измерения
          переноса и данные эксплуатации.
        </p>
      </div>
    </section>
  );
}
