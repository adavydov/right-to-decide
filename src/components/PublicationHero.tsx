import Image from "next/image";
import Link from "next/link";
import { assetPath, siteConfig } from "@/lib/site-config";
import { book } from "@/lib/book";
import { home } from "@/data/site-copy.json";
import styles from "./PublicationHero.module.css";

export function PublicationHero() {
  return <section className={styles.hero} aria-labelledby="publication-title">
    <div className={`wrap ${styles.grid}`}>
      <div className={styles.introduction}>
        <p className={`eyebrow ${styles.eyebrow}`}>{home.hero.eyebrow}</p>
        <h1 id="publication-title" className={styles.title}>Право<br />на решение</h1>
        <p className={styles.subtitle}>{siteConfig.subtitle}</p>
        <p className={styles.authors}><span>А. М. Давыдов</span> · <span>А. А. Давыдов</span> · <span>Е. А. Давыдов</span></p>
        <div className={styles.actions}>
          <Link href="/read/" className="button">Читать книгу <span aria-hidden="true">↗</span></Link>
          <Link href="/contents/" className={styles.contents}>Содержание <span aria-hidden="true">↗</span></Link>
        </div>
        <p className={styles.edition}>В открытом доступе · редакция {book.editionVersion}</p>
      </div>
      <figure className={styles.figure}>
        <Image className={styles.cover} src={assetPath(siteConfig.coverPath)} alt="Обложка книги «Право на решение»: орбитальная структура и расходящиеся траектории на тёплом светлом фоне." width={siteConfig.coverWidth} height={siteConfig.coverHeight} sizes="(max-width: 700px) 270px, (max-width: 1000px) 310px, 390px" priority />
      </figure>
    </div>
    <div className={`wrap ${styles.bottom}`}><span>{home.hero.captionIdea}</span><a href="#about">О книге <span aria-hidden="true">↓</span></a></div>
  </section>;
}
