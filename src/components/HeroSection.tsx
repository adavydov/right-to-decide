import { governingAnswer } from "@/data/content";

import { DecisionArtwork } from "./DecisionArtwork";
import styles from "./HeroSection.module.css";

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="book-title">
      <div className={styles.cover}>
        <DecisionArtwork className={styles.artwork} />
        <div className={styles.coverOverlay}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>
              Тезисы будущей монографии · Алексей Михайлович Давыдов
            </p>
            <h1 id="book-title">Право на решение</h1>
            <p className={styles.subtitle}>
              Инженерное образование как система когнитивного допуска в эпоху
              искусственного интеллекта
            </p>
          </div>
          <p className={styles.coverStatement}>
            Ответ подешевел. Ошибка осталась физической. Ответственность —
            человеческой.
          </p>
        </div>
      </div>

      <div className={styles.caption}>
        <p>{governingAnswer}</p>
        <div className={styles.actions} aria-label="Разделы страницы">
          <a className="primary-link" href="#theses">
            Тезисы книги
          </a>
          <a className="secondary-link" href="#contents">
            Примерное содержание
          </a>
        </div>
      </div>
    </section>
  );
}
