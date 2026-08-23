import {
  finalFormula,
  nonCompensatoryGates,
  rightToDecideChain,
  systemMetrics,
} from "@/data/content";

import styles from "./FrameworkSection.module.css";

export function FrameworkSection() {
  return (
    <section className={`section-shell ${styles.section}`} id="framework">
      <div className="page-shell">
        <header className="section-intro">
          <p className="section-kicker">03 · Итоговая формула</p>
          <div className="section-heading">
            <h2>Право на решение возникает после пяти разных событий</h2>
            <p>
              Способность описывает, что человек умеет. Доказательство подтверждает
              это в независимом испытании. Полномочие определяет, что ему разрешено
              делать в реальной системе.
            </p>
          </div>
        </header>

        <ol className={styles.chain}>
          {rightToDecideChain.map((step, index) => (
            <li className={styles.chainCell} key={step.title}>
              <span className={styles.chainNumber} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>

        <p className={styles.formula}>{finalFormula}</p>

        <div className={styles.gateCard}>
          <p className={styles.gateLabel}>Неперекрываемые пороги готовности</p>
          <div
            className={styles.gateExpression}
            aria-label={nonCompensatoryGates.join(" и ")}
          >
            {nonCompensatoryGates.map((gate, index) => (
              <span className={styles.gatePair} key={gate}>
                {index > 0 ? (
                  <span className={styles.conjunction} aria-hidden="true">
                    ∧
                  </span>
                ) : null}
                <span className={styles.gateTerm}>{gate}</span>
              </span>
            ))}
          </div>
          <p className={styles.gateStatement}>
            Провал одного обязательного звена нельзя компенсировать успехом в другом.
          </p>
        </div>

        <aside className={styles.authority}>
          <h3>Полномочия распределены</h3>
          <p>
            Университет формирует и подтверждает образовательную готовность. Профессия
            задаёт норму. Работодатель и регулятор предоставляют операционное
            полномочие. Эксплуатация подтверждает или отменяет доверие.
          </p>
        </aside>

        <div className={styles.metrics}>
          {systemMetrics.map((metric) => (
            <article className={styles.metric} key={metric.title}>
              <h3>{metric.title}</h3>
              <p>{metric.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
