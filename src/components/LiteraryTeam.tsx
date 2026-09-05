import Link from "next/link";
import { editorialTeam } from "@/lib/editorial-team";
import { assetPath } from "@/lib/site-config";
import styles from "./LiteraryTeam.module.css";

export function LiteraryTeam({ compact = false }: { compact?: boolean }) {
  const team = editorialTeam;
  const roleCount = 1 + team.groups.reduce((total, group) => total + group.roles.length, 0);
  return (
    <section id="literary-team" aria-labelledby="literary-team-title" className={`${styles.team} ${compact ? styles.compact : ""}`}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">ИИ-агенты · {roleCount} литературных ролей</p>
          <h2 id="literary-team-title" className={styles.title}>{team.title}</h2>
        </div>
        <div className={styles.introduction}>
          <p>{team.intro}</p>
          <p className={styles.roleNote}>{team.roleNote}</p>
        </div>
      </header>
      <div className={styles.hierarchy}>
        <div className={styles.direction}>
          <h3>{team.humanDirection.title}</h3>
          <p>{team.humanDirection.description}</p>
        </div>
        <div className={styles.connector} aria-hidden="true">↓</div>
        <div className={styles.conductor}>
          <div>
            <p className={styles.conductorRole}>{team.conductor.role}</p>
            <h3>{team.conductor.name}</h3>
          </div>
          <p className={styles.conductorDescription}>{team.conductor.description}</p>
        </div>
        <div className={styles.branch} aria-hidden="true" />
        <div className={styles.groups}>
          {team.groups.map((group) => (
            <details key={group.id} className={styles.group} open={!compact}>
              <summary className={styles.groupSummary}>
                <span className={styles.groupHeading}>
                  <span className={styles.groupTitle}>{group.title}</span>
                  <span className={styles.toggle} aria-hidden="true" />
                </span>
                <span className={styles.groupDescription}>{group.description}</span>
                <span className={styles.roleNames}>
                  {group.roles.map((role) => <span key={role.id}>{role.name}</span>)}
                </span>
              </summary>
              <dl className={styles.roles}>
                {group.roles.map((role) => (
                  <div key={role.id} className={styles.role}>
                    <dt>{role.name}</dt>
                    <dd>{role.description}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
      </div>
      <div className={styles.principle}>
        <div className={styles.principleIntro}>
          <h3>{team.principle.title}</h3>
          <p>{team.principle.description}</p>
        </div>
        <ol className={styles.steps}>
          {team.principle.steps.map((step) => (
            <li key={step.title}><h4>{step.title}</h4><p>{step.description}</p></li>
          ))}
        </ol>
      </div>
      <div className={styles.links}>
        {compact && <Link href="/authors/#literary-team" className={styles.link}>Подробнее о команде <span aria-hidden="true">↗</span></Link>}
        <a href={assetPath("/editorial-team.json")} type="application/json" className={styles.link}>Команда в JSON <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  );
}
