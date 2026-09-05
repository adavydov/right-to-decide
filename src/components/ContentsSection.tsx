import Link from "next/link";
import {book} from "@/lib/book";
export function ContentsSection(){return <section className="publication-section wrap"><div className="section-top"><h2>Шесть частей. Восемнадцать глав.</h2><Link href="/contents/">Развёрнутое содержание ↗</Link></div><div className="preview-list">{book.parts.map(p=><Link className="preview-row" key={p.id} href={"/contents/#"+p.id}><small>{p.number}</small><span>{p.title}</span><span>↗</span></Link>)}</div></section>}
