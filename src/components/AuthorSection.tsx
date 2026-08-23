import Image from "next/image";

import { author } from "@/data/author";
import { assetPath } from "@/lib/site-config";

import styles from "./AuthorSection.module.css";

export function AuthorSection() {
  return (
    <section
      className={`section-shell ${styles.section}`}
      id="author"
      aria-labelledby="author-heading"
    >
      <div className="page-shell">
        <header className="section-intro">
          <p className="section-kicker">08 · Об авторе</p>
          <div className="section-heading">
            <h2 id="author-heading">
              Автор работает внутри системы, которую предлагает перестроить
            </h2>
            <p>
              Полвека инженерной, научной, преподавательской и управленческой
              практики — основание говорить не только о кризисе образования, но
              и о механике его пересборки.
            </p>
          </div>
        </header>

        <div className={styles.authorGrid}>
          <figure className={styles.portraitFigure}>
            <a
              className={styles.portraitLink}
              href={author.portrait.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Официальный профиль Алексея Михайловича Давыдова на сайте РУТ (МИИТ)"
            >
              <Image
                className={styles.portrait}
                src={assetPath(author.portrait.src)}
                alt={author.portrait.alt}
                width={587}
                height={782}
                sizes="(max-width: 760px) calc(100vw - 40px), 360px"
              />
            </a>
            <figcaption>
              <a
                href={author.portrait.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {author.portrait.attribution} ↗
              </a>
            </figcaption>
          </figure>

          <div className={styles.authorCopy}>
            <p className={styles.name}>{author.name}</p>
            <p className={styles.role}>{author.role}</p>
            <p className={styles.bio}>{author.bio}</p>
            <div className={styles.whyBlock}>
              <p className={styles.whyLabel}>Почему именно этот автор</p>
              <p>{author.whyThisAuthor}</p>
            </div>
          </div>
        </div>

        <section className={styles.timelineSection} aria-labelledby="author-path">
          <div className={styles.subhead}>
            <p className={styles.subheadIndex}>01</p>
            <h3 id="author-path">Профессиональная траектория</h3>
          </div>
          <ol className={styles.timeline}>
            {author.timeline.map((entry) => (
              <li className={styles.timelineRow} key={entry.period}>
                <p className={styles.period}>{entry.period}</p>
                <div>
                  <h4>{entry.title}</h4>
                  <p>{entry.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className={styles.credentialsGrid}>
          <section aria-labelledby="author-awards">
            <div className={styles.subhead}>
              <p className={styles.subheadIndex}>02</p>
              <h3 id="author-awards">Профессиональное признание</h3>
            </div>
            <ul className={styles.awards}>
              {author.awards.map((award) => (
                <li key={award}>{award}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="author-identifiers">
            <div className={styles.subhead}>
              <p className={styles.subheadIndex}>03</p>
              <h3 id="author-identifiers">Научные идентификаторы</h3>
            </div>
            <dl className={styles.identifiers}>
              <div>
                <dt>ORCID</dt>
                <dd>{author.identifiers.orcid}</dd>
              </div>
              <div>
                <dt>РИНЦ AuthorID</dt>
                <dd>{author.identifiers.rsciAuthorId}</dd>
              </div>
              <div>
                <dt>SPIN-код</dt>
                <dd>{author.identifiers.rsciSpin}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className={styles.linksGrid}>
          <section aria-labelledby="author-works">
            <div className={styles.subhead}>
              <p className={styles.subheadIndex}>04</p>
              <h3 id="author-works">Избранные работы</h3>
            </div>
            <ul className={styles.externalList}>
              {author.selectedWorks.map((work) => (
                <li key={work.url}>
                  <a href={work.url} target="_blank" rel="noreferrer">
                    <span>{work.title}</span>
                    <span className={styles.linkMeta}>{work.year} ↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="author-verification">
            <div className={styles.subhead}>
              <p className={styles.subheadIndex}>05</p>
              <h3 id="author-verification">Профили и первичные записи</h3>
            </div>
            <ul className={styles.externalList}>
              {author.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    <span>{link.label}</span>
                    <span className={styles.linkArrow} aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className={styles.contact}>
          <div>
            <p className={styles.contactLabel}>Рабочий контакт</p>
            <h3>Есть контур, где теорию можно проверить?</h3>
            <p>
              Автор открыт к содержательному разговору с университетами,
              корпорациями и государственными институтами о пилотах, данных и
              границах когнитивного допуска.
            </p>
          </div>
          <a className="primary-link" href={`mailto:${author.email}`}>
            Написать автору
          </a>
        </div>
      </div>
    </section>
  );
}

export default AuthorSection;
