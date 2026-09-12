import { notFound } from "next/navigation";
import dossier from "@/data/research-v10.json";
import { book, type BookBlock } from "@/lib/book";
import { renderBookBlocks } from "@/components/ChapterView";
import { assetPath, siteConfig } from "@/lib/site-config";
type Section = { id: string; title: string; blocks: BookBlock[]; notes: {id: string; number: number; blocks: BookBlock[]}[]; downloads?: {name: string; label: string; path: string}[] };
export const metadata = { title: "Исследования и модели · редакция 10.0", alternates: {canonical: siteConfig.publicUrl + "/research/v10/"} };
function Content({ section }: {section: Section}) { return <>{renderBookBlocks(section.blocks)}{section.notes.length > 0 && <ol className="reading-notes">{section.notes.map(n => <li id={n.id} key={n.id} value={n.number}>{renderBookBlocks(n.blocks)}</li>)}</ol>}</>; }
export default function ResearchV10() {
  if (book.editionVersion !== "10.0" || dossier.status !== "accepted-public-package") notFound();
  const intro = dossier as unknown as Section & {models: Section[]};
  return <main id="main-content" className="subpage wrap"><div style={{maxWidth:800,margin:"0 auto"}}><p className="eyebrow">Редакция 10.0</p><h1 className="page-heading">{intro.title}</h1><div className="reading-copy"><Content section={intro} />
    {intro.models.map(model => <section id={model.id} key={model.id} style={{marginTop:64,scrollMarginTop:100}}><h2>{model.title}</h2><Content section={model}/><ul>{model.downloads?.map(file => <li key={file.name}><a href={assetPath(file.path)} download>{file.label} ↓</a></li>)}</ul></section>)}
  </div></div></main>;
}
