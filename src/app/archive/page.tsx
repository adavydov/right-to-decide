import { EditionChoice } from "@/components/EditionChoice";
import Link from "next/link";
import {archiveChapters,previousEdition} from "@/lib/book";
import {displayBookTitle} from "@/lib/book-display";
import {siteConfig} from "@/lib/site-config";
export const metadata={title:"Архив книги",alternates:{canonical:siteConfig.publicUrl+"/archive/"},robots:{index:false,follow:true}};
export default function ArchiveIndex(){return <main id="main-content" className="subpage wrap"><p className="eyebrow">История книги</p><h1 className="page-heading">Архив редакции</h1><EditionChoice archived /><p className="page-intro">Здесь сохранена прежняя рукопись от {previousEdition.edition.split("-").reverse().join(".")} и опубликованное предисловие v8.0. Названия и нумерация относятся к этой редакции.</p><p style={{margin:"24px 0 48px"}}><Link className="button" href="/contents/">Новое содержание ↗</Link></p><div className="preview-list">{archiveChapters.map(c=><Link className="preview-row" key={c.id} href={"/archive/"+c.id+"/"}><small>{c.number??"—"}</small><span>{displayBookTitle(c.title)}</span><span aria-hidden="true">↗</span></Link>)}</div></main>}
