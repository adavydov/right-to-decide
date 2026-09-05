import Image from "next/image";
import Link from "next/link";
import { assetPath, siteConfig } from "@/lib/site-config";
import styles from "./PublicationHero.module.css";

export function PublicationHero() {
  return (
    <section className={styles.hero} aria-labelledby="publication-title">
      <div className="wrap">
        <header className={styles.introduction}>
          <p className={`eyebrow ${styles.eyebrow}`}>
            Человек, искусственный интеллект и образование
          </p>
          <h1 id="publication-title" className={styles.title}>
            {siteConfig.title}
          </h1>
          <p className={styles.subtitle}>{siteConfig.subtitle}</p>
          <p className={styles.answer}>
            Как сделать так, чтобы работа рядом с сильным ИИ развивала человеческую
            способность ставить цели, создавать новое и менять общий курс.
          </p>
          <div className={styles.actions}>
            <Link href="/read/" className="button">
              Читать книгу <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/contents/" className="button secondary">
              Открыть содержание
            </Link>
          </div>
          <p className={styles.authors}>
            <span>А. М. Давыдов</span>
            <span aria-hidden="true">·</span>
            <span>А. А. Давыдов</span>
            <span aria-hidden="true">·</span>
            <span>Е. А. Давыдов</span>
          </p>
        </header>

        <figure className={styles.figure}>
          <div className={styles.stage}>
            <div className={styles.book}>
              <Image
                className={styles.cover}
                src={assetPath(siteConfig.coverPath)}
                alt="Обложка книги «Право на решение. Как оставаться авторами будущего рядом с более сильным интеллектом»"
                width={siteConfig.coverWidth}
                height={siteConfig.coverHeight}
                sizes="(max-width: 375px) 76vw, (max-width: 760px) 280px, (max-width: 1100px) 280px, 320px"
                priority
              />
            </div>
          </div>
          <figcaption className={styles.caption}>
            <span className={styles.captionIdea}>
              Знание. Самостоятельность. Возможность изменить будущее.
            </span>
            <span className={styles.edition}>
              Сайт обновлён · 5 сентября 2026
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
