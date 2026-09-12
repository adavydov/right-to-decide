import Link from "next/link";
import { BibliographyCatalog } from "@/components/BibliographyCatalog";
import type { Bibliography } from "@/types/library-v10";
export function BibliographyPage({data,preview=false}: {data: Bibliography;preview?: boolean}) {
  return <main id="main-content" className="subpage wrap"><header className="page-heading-row"><div>
    <p className="eyebrow">{preview?"Локальный просмотр":"Читать дальше"}</p><h1 className="page-heading">Библиотека</h1>
    <p className="page-intro">Книги, исследования и свидетельства «Права на решение». Аннотации помогают выбрать свой маршрут, а отметки чтения показывают, какая часть источника разобрана.</p>
    <p style={{marginTop:22,fontSize:14,lineHeight:1.7}}><Link href="/editions/v9/library/">Библиотека и свидетельства редакции 9.0 ↗</Link></p>
  </div></header><BibliographyCatalog data={data}/></main>;
}
