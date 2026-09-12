import Link from "next/link";
import {renderBookBlocks} from "@/components/ChapterView";
import {assetPath} from "@/lib/site-config";
import type {BookBlock} from "@/lib/book";
export type Manifesto={title:string;blocks:BookBlock[];notes:{id:string;number:number;blocks:BookBlock[]}[]};
export function ManifestoV10({data,preview=false}:{data:Manifesto;preview?:boolean}){
  return <main id="main-content" className="subpage wrap"><div style={{maxWidth:800,margin:"0 auto"}}><p className="eyebrow">{preview?"Локальный просмотр":"Право на решение · редакция 10.0"}</p><h1 className="page-heading">{data.title}</h1><article className="reading-copy" style={{marginTop:40}} aria-label="Манифест редакции 10.0">{renderBookBlocks(data.blocks)}{data.notes.length>0&&<ol className="reading-notes">{data.notes.map(n=><li key={n.id} id={n.id} value={n.number}>{renderBookBlocks(n.blocks)}</li>)}</ol>}</article><nav aria-label="Продолжить чтение" style={{display:"flex",flexWrap:"wrap",gap:"12px 24px",marginTop:40,fontSize:14,lineHeight:1.8}}><Link href="/contents/">К книге ↗</Link><Link href="/editions/v9/manifesto/">Конституция редакции 9.0 ↗</Link>{!preview&&<a href={assetPath('/manifesto/v10/manifesto.md')} download>Скачать текст ↓</a>}</nav></div></main>;
}
