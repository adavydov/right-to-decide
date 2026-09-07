"use client";
import Link from "next/link";
import {useMemo,useState} from "react";
import type {ChapterNavigation} from "@/lib/book-display";
import {displayBookTitle} from "@/lib/book-display";
import {assetPath} from "@/lib/site-config";
import styles from "./ContentsCatalog.module.css";
type Item=ChapterNavigation & {summary?:string};
type Part={id:string;title:string;description?:string[]};
export function ContentsCatalog({items,parts=[]}:{items:Item[];parts?:Part[]}){
const [query,setQuery]=useState("");
const filtered=useMemo(()=>items.filter(c=>{const p=parts.find(p=>p.title===c.part);return [c.title,c.part,c.summary,...(c.headings??[]),...(p?.description??[])].join(" ").toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"));}),[items,parts,query]);
const groups=[{id:"prologue",title:"Пролог",description:[] as string[],chapters:filtered.filter(c=>!c.part&&c.kind!=="backmatter"&&c.kind!=="appendix")},...parts.map(p=>({...p,chapters:filtered.filter(c=>c.part===p.title)})),{id:"epilogue-section",title:"Эпилог",description:[] as string[],chapters:filtered.filter(c=>!c.part&&c.kind==="backmatter")},{id:"appendices-section",title:"Приложения",description:[] as string[],chapters:filtered.filter(c=>c.kind==="appendix")}].filter(g=>g.chapters.length);
return <div><div className={styles.toolbar}><label className={styles.search}><span aria-hidden="true">⌕</span><input type="search" placeholder="Найти главу или тему" aria-label="Поиск по содержанию" value={query} onChange={e=>setQuery(e.target.value)}/></label><span className={styles.count} role="status">{query?"Найдено разделов: "+filtered.length:parts.length+" частей · глав для чтения: "+items.filter(c=>c.kind==="chapter"&&c.status==="available").length+" из "+items.filter(c=>c.kind==="chapter").length}</span></div>{!filtered.length?<p className="empty-message">Разделов по этому запросу не найдено. Попробуйте другое слово.</p>:groups.map(g=><section className={styles.group} key={g.id} id={g.id}><h2>{displayBookTitle(g.title)}</h2><div>{g.description?.length?<div className={styles.description}>{g.description.map((p,i)=><p key={i}>{p}</p>)}</div>:null}{g.chapters.map(c=><article key={c.id} id={c.id==="prologue"?"prologue-outline":c.id} className={styles.entry}><div className={styles.row}><span className={styles.number}>{c.number===null?"—":c.kind==="appendix"?String(c.number):String(c.number).padStart(2,"0")}</span><h3 className={styles.title}>{c.status==="available"?<Link href={"/read/"+c.id+"/"}>{displayBookTitle(c.title).replace(/^Глава \d+[.\s]+/i,"")}</Link>:displayBookTitle(c.title).replace(/^Глава \d+[.\s]+/i,"")}</h3><span className={styles.meta}>{c.status==="available"?"Читать ↗":"В плане"}</span></div>{c.summary&&<p className={styles.summary}>{c.summary}</p>}{c.status==="available"&&c.docx&&<div className={styles.download}><a href={assetPath(c.docx)} download aria-label={`Скачать DOCX: ${c.title}`}>Скачать DOCX ↓</a></div>}</article>)}</div></section>)}</div>;
}
