"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { stakeholderStakes } from "@/data/content";
import styles from "./AudienceSection.module.css";

const [student, society, business, university] = stakeholderStakes;

const audiences = [
  {
    label: "Студенту",
    headline: "Современные инструменты ещё не дают инженерной опоры.",
    description: student.demand,
  },
  {
    label: "Университету",
    headline: "Современной программе нужен новый способ проверки результата.",
    description: university.demand,
  },
  {
    label: "Бизнесу",
    headline: "Автоматизируя работу новичков, можно потерять будущих ведущих инженеров.",
    description: business.demand,
  },
  {
    label: "Обществу",
    headline: "Число дипломов не гарантирует способности управлять технологиями.",
    description: society.demand,
  },
];

export function AudienceSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const instanceId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const headingId = `${instanceId}-audience-heading`;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % audiences.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + audiences.length) % audiences.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = audiences.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Для кого эта книга</p>
        <h2 className={styles.heading} id={headingId}>
          Вопрос один.<br />Ставки у каждого свои.
        </h2>

        <div className={styles.tabs} role="tablist" aria-label="Выберите свой взгляд на книгу">
          {audiences.map((audience, index) => (
            <button
              key={audience.label}
              ref={(element) => { tabRefs.current[index] = element; }}
              className={styles.tab}
              type="button"
              role="tab"
              id={`${instanceId}-audience-tab-${index}`}
              aria-controls={`${instanceId}-audience-panel-${index}`}
              aria-selected={activeIndex === index}
              tabIndex={activeIndex === index ? 0 : -1}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {audience.label}
            </button>
          ))}
        </div>

        {audiences.map((audience, index) => (
          <div
            key={audience.label}
            className={styles.panel}
            role="tabpanel"
            id={`${instanceId}-audience-panel-${index}`}
            aria-labelledby={`${instanceId}-audience-tab-${index}`}
            hidden={activeIndex !== index}
            tabIndex={0}
          >
            <h3 className={styles.statement}>{audience.headline}</h3>
            <div className={styles.explanation}>
              <p className={styles.panelLabel}>На что обратить внимание</p>
              <p className={styles.description}>{audience.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
