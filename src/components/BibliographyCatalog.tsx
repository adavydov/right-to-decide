"use client";
import { useId, useMemo, useState } from "react";
import type { Bibliography } from "@/types/library-v10";
import styles from "./BibliographyCatalog.module.css";

const norm=(text: string)=>text.normalize("NFKC").toLocaleLowerCase("ru").replaceAll("ё","е");
const plural=(n:number,one:string,few:string,many:string)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
export function BibliographyCatalog({data}: {data: Bibliography}) {
  const [query,setQuery]=useState(""); const [category,setCategory]=useState(""); const [reading,setReading]=useState("");
  const prefix=useId();
  const categories=useMemo(()=>Array.from(new Set(data.sources.map(s=>s.category))).sort((a,b)=>a.localeCompare(b,"ru")),[data]);
  const readings=useMemo(()=>Array.from(new Map(data.sources.map(s=>[s.reading.kind,s.reading.label])).entries()),[data]);
  const found=useMemo(()=>data.sources.filter(s=>(!category||s.category===category)&&(!reading||s.reading.kind===reading)&&(!query.trim()||norm([s.title,...s.authors,s.edition,s.annotation,s.role].join(" ")).includes(norm(query.trim())))),[data,category,reading,query]);
  const reset=()=>{setQuery("");setCategory("");setReading("");};
  return <section aria-label="Библиографический каталог" className={styles.catalog}>
    <div className={styles.overview}><p><strong>{data.summary.records}</strong> {plural(data.summary.records,"запись","записи","записей")} <span>·</span> <strong>{data.summary.cards}</strong> карточек разбора</p><p>{data.readingNote}</p></div>
    <div className={styles.filters}>
      <div className={styles.search}><label htmlFor={prefix+"-query"}>Поиск по библиотеке</label><input id={prefix+"-query"} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Автор, название или вопрос" /></div>
      <div><label htmlFor={prefix+"-category"}>Тема</label><select id={prefix+"-category"} value={category} onChange={e=>setCategory(e.target.value)}><option value="">Все темы</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
      <div><label htmlFor={prefix+"-reading"}>Охват чтения</label><select id={prefix+"-reading"} value={reading} onChange={e=>setReading(e.target.value)}><option value="">Любой охват</option>{readings.map(([k,label])=><option value={k} key={k}>{label}</option>)}</select></div>
    </div>
    <div className={styles.resultLine}><p role="status" aria-live="polite">Показано {found.length} из {data.summary.records}</p>{(query||category||reading)&&<button type="button" onClick={reset}>Сбросить фильтры</button>}</div>
    {found.length===0?<div className={styles.empty}><h2>Совпадений нет</h2><p>Попробуйте имя автора, другое слово или более широкий охват.</p><button type="button" onClick={reset}>Показать всю библиотеку</button></div>:<ol className={styles.entries}>{found.map(s=><li key={s.id} id={s.id} className={styles.entry}>
      <div className={styles.meta}><span>{s.category}</span><span>{s.cardCount>0?`${s.cardCount} ${plural(s.cardCount,"карточка","карточки","карточек")}` : "Каталожная запись"}</span></div>
      <div><p className={styles.authors}>{s.authors.length>4?s.authors.slice(0,3).join(" · ")+" и др.":s.authors.join(" · ")}</p><h2>{s.title}</h2><p className={styles.edition}>{s.edition}</p><p className={styles.annotation}>{s.annotation}</p>
        <details className={styles.scope}><summary>{s.reading.label}<span aria-hidden="true"> +</span></summary><div><p>{s.reading.scope}</p><p><strong>Роль для книги.</strong> {s.role}.</p></div></details>
        {s.links.length>0&&<ul className={styles.links}>{s.links.map((link,i)=><li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}{s.links.length>1?` ${i+1}`:""} <span aria-hidden="true">↗</span></a></li>)}</ul>}
      </div>
    </li>)}</ol>}
  </section>;
}
