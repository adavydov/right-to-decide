import Image from "next/image";
import Link from "next/link";

import authorsData from "@/data/authors.json";
import { assetPath } from "@/lib/site-config";

import styles from "./AuthorsGrid.module.css";

type AuthorsGridProps = {
  compact?: boolean;
};

export function AuthorsGrid({ compact = false }: AuthorsGridProps) {
  const NameHeading = compact ? "h3" : "h2";

  const cards = (
    <div className={styles.grid}>
      {authorsData.authors.map((author) => (
        <article
          className={styles.author}
          key={author.id}
          aria-labelledby={`author-${author.id}`}
        >
          <figure className={styles.figure}>
            {author.photo ? (
              <div className={styles.portrait}>
                <Image
                  className={styles.image}
                  src={assetPath(author.photo.src)}
                  alt={author.photo.alt}
                  width={author.photo.width}
                  height={author.photo.height}
                  sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1100px) calc((100vw - 136px) / 3), (max-width: 1440px) calc((100vw - 256px) / 3), 395px"
                />
              </div>
            ) : (
              <div className={styles.monogramPanel} aria-hidden="true">
                <span className={styles.monogram}>ЕД</span>
                <span className={styles.monogramCaption}>Егор Давыдов</span>
              </div>
            )}
          </figure>

          <div className={styles.details}>
            <NameHeading
                className={styles.name}
                id={`author-${author.id}`}
            >
              {author.shortName}
              <span>{author.name.replace(`${author.shortName} `, "")}</span>
            </NameHeading>
            <p className={styles.role}>{author.role}</p>

            {!compact && (
              <>
                <p className={styles.bio}>{author.bio}</p>
                {author.links.length > 0 && (
                  <ul className={styles.links} aria-label={`Источники: ${author.name}`}>
                    {author.links.map((link) => (
                      <li key={link.url}>
                        <a href={link.url} target="_blank" rel="noreferrer">
                          {link.label}
                          <span aria-hidden="true">↗</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {author.photo && (
                  <p className={styles.credit}>
                    {author.photo.sourceUrl ? (
                      <a href={author.photo.sourceUrl} target="_blank" rel="noreferrer">
                        {author.photo.credit}
                      </a>
                    ) : author.photo.credit}
                  </p>
                )}
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );

  if (!compact) return cards;

  return (
    <section className={styles.section} id="authors" aria-labelledby="authors-heading">
      <div className="wrap">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Авторы</p>
            <h2 className={styles.title} id="authors-heading">
              Образование, технологии и управление
            </h2>
          </div>
          <Link className={styles.more} href="/authors/">
            Об авторах <span aria-hidden="true">↗</span>
          </Link>
        </header>
        {cards}
      </div>
    </section>
  );
}
