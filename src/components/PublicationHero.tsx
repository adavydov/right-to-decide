import Image from "next/image";
import Link from "next/link";
import { assetPath, siteConfig } from "@/lib/site-config";
import { home } from "@/data/site-copy.json";
import styles from "./PublicationHero.module.css";

export function PublicationHero() {
  return (
    <section className={styles.hero} aria-labelledby="publication-title">
      <div className="wrap">
        <figure className={styles.figure}>
          <div className={styles.stage}>
            <Image
              className={styles.cover}
              src={assetPath(siteConfig.coverPath)}
              alt="Терракотовая линия меняет траекторию сложной орбитальной структуры и открывает несколько новых направлений — образ права на самостоятельное решение."
              width={siteConfig.coverWidth}
              height={siteConfig.coverHeight}
              sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1100px) calc(100vw - 80px), 1240px"
              priority
            />
            <header className={styles.introduction}>
              <p className={`eyebrow ${styles.eyebrow}`}>
                {home.hero.eyebrow}
              </p>
              <h1 id="publication-title" className={styles.title}>
                {siteConfig.title}
              </h1>
              <p className={styles.subtitle}>{siteConfig.subtitle}</p>
            </header>
          </div>
          <figcaption className={styles.caption}>
            <span className={styles.captionIdea}>{home.hero.captionIdea}</span>
            <span className={styles.edition}>Электронная книга · 2026</span>
          </figcaption>
        </figure>
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
      </div>
    </section>
  );
}
