import { stakeholderStakes } from "@/data/content";

import styles from "./ProblemSection.module.css";

const ruptures = [
  {
    number: "01",
    title: "Лестница взросления",
    text: "ИИ забирает черновые расчёты, первичную диагностику, простой код и документацию. Исчезает работа, на которой новичок калибровал суждение.",
  },
  {
    number: "02",
    title: "Лестница доверия",
    text: "ИИ генерирует убедительные расчёты, код, отчёты и портфолио. Артефакт больше не подтверждает понимание.",
  },
];

export function ProblemSection() {
  return (
    <section
      id="problem"
      className={`section-shell ${styles.problem}`}
      aria-labelledby="problem-heading"
    >
      <div className="section-intro">
        <p className="section-kicker">01 · Постановка проблемы</p>
        <div className="section-heading">
          <h2 id="problem-heading">
            ИИ сломал две лестницы, на которых держалась инженерная профессия
          </h2>
          <p>
            ИИ одновременно меняет путь формирования инженера и основания, по
            которым университет, работодатель и общество признают его готовность.
            Один разрыв лишает человека опыта взросления. Второй лишает институты
            надёжного доказательства компетентности.
          </p>
        </div>
      </div>

      <div className={styles.doubleGrid}>
        {ruptures.map((rupture) => (
          <article className={styles.rupturePanel} key={rupture.number}>
            <p className={styles.panelNumber}>{rupture.number}</p>
            <h3>{rupture.title}</h3>
            <p className={styles.panelText}>{rupture.text}</p>
          </article>
        ))}
      </div>

      <p className={styles.conclusion}>
        Университету придётся заново спроектировать и путь, на котором человек
        становится инженером, и доказательство того, что инженер состоялся.
      </p>

      <div className={styles.stakeholderGrid}>
        {stakeholderStakes.map((stakeholder) => (
          <article className={styles.stakeholderCard} key={stakeholder.audience}>
            <p className={styles.audience}>{stakeholder.audience}</p>
            <p className={styles.warning}>{stakeholder.warning}</p>
            <p className={styles.demand}>{stakeholder.demand}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
