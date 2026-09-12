import Link from "next/link";
import {assetPath} from "@/lib/site-config";
import type {PublicEditorialTeam as Team} from "@/types/editorial-v10";
import styles from "./PublicEditorialTeam.module.css";
export function PublicEditorialTeam({team,compact=false}:{team:Team;compact?:boolean}){
  return <section id="literary-team" aria-labelledby="literary-team-title" className={styles.team}>
    <header><p className="eyebrow">Виртуальная редакция · {team.roles.length} ролей</p><h2 id="literary-team-title">{team.title}</h2><p>{team.intro}</p><p className={styles.note}>{team.roleNote}</p></header>
    <div className={styles.direction}><h3>{team.humanDirection.title}</h3><p>{team.humanDirection.description}</p></div>
    <ol className={styles.workflow}>{team.workflow.map((step,i)=><li key={step.id}><span>{String(i+1).padStart(2,"0")}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
    {!compact&&<div className={styles.roles}>{team.roles.map(role=><article key={role.id} id={"editorial-role-"+role.id}><h3>{role.name}</h3><p>{role.description}</p>{role.libraryThemes.length>0&&<p className={styles.themes}>{role.libraryThemes.join(" · ")}</p>}</article>)}</div>}
    <div className={styles.links}>{compact&&<Link href="/authors/#literary-team">О редакции ↗</Link>}<Link href="/library/">Библиотека ↗</Link><Link href="/editions/v9/editorial/">Команда редакции 9.0 ↗</Link><a href={assetPath('/editorial-team.json')} type="application/json">Описание в JSON ↗</a></div>
  </section>;
}
