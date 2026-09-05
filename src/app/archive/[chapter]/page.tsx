import Link from "next/link";
import {notFound} from "next/navigation";
import {renderBookBlocks} from "@/components/ChapterView";
import {archiveChapters,previousEdition} from "@/lib/book";
import {displayBookTitle} from "@/lib/book-display";
import {siteConfig} from "@/lib/site-config";
export const dynamicParams=false;
export function generateStaticParams(){return archiveChapters.map(c=>({chapter:c.id}));}
export async function generateMetadata({params}:{params:Promise<{chapter:string}>}){const {chapter:id}=await params;const c=archiveChapters.find(c=>c.id===id);return {title:"Архив · "+(c?displayBookTitle(c.title):"Раздел"),alternates:{canonical:siteConfig.publicUrl+"/archive/"+id+"/"},robots:{index:false,follow:true}};}
export default async function ArchiveChapter({params}:{params:Promise<{chapter:string}>}){const {chapter:id}=await params;const c=archiveChapters.find(c=>c.id===id);if(!c)notFound();const references=new Set(c.blocks.flatMap(b=>b.type==="paragraph"||b.type==="heading"?b.runs?.flatMap(r=>r.noteId?[r.noteId]:[])??[]:[]));const notes=previousEdition.notes.filter(n=>n.chapterId===c.id||references.has(n.id));return <main id="main-content" className="subpage wrap"><div style={{maxWidth:800,margin:"0 auto"}}><p className="eyebrow">Архив · прежняя редакция</p><p style={{margin:"20px 0"}}><Link className="text-link" href="/archive/">← Архив книги</Link>{" · "}<Link className="text-link" href="/contents/">Новое содержание ↗</Link></p><h1 className="reading-title">{displayBookTitle(c.title)}</h1><p className="reading-meta">Название и нумерация сохранены по прежней редакции.</p><article className="reading-copy">{renderBookBlocks(c.blocks)}{notes.length>0&&<section className="reading-notes"><h2>{c.notesHeading||"Примечания"}</h2><ol>{notes.map(n=><li key={n.id} id={n.id}>{renderBookBlocks(n.blocks)}</li>)}</ol></section>}</article></div></main>}
