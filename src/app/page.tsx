import Link from "next/link";
import { PublicationHero } from "@/components/PublicationHero";
import { AuthorsGrid } from "@/components/AuthorsGrid";
import { siteConfig } from "@/lib/site-config";
import { book, publicationSummary } from "@/lib/book";
import { displayBookTitle } from "@/lib/book-display";
import { getBookCreditsStructuredData } from "@/lib/editorial-team";
import { home } from "@/data/site-copy.json";

export const metadata = { alternates: { canonical: siteConfig.publicUrl + "/" } };

export default function HomePage() {
  const structured = getBookCreditsStructuredData();
  return <main id="main-content">
    <PublicationHero />
    <section className="publication-section wrap" id="about">
      <div className="publication-grid">
        <div><p className="eyebrow publication-kicker">{home.about.eyebrow}</p><h2 className="publication-heading">{home.about.heading}</h2></div>
        <div className="publication-prose">{home.about.paragraphs.map(text => <p key={text}>{text}</p>)}</div>
      </div>
    </section>
    <section className="pillars">
      <div className="wrap">
        <div className="section-top"><div><p className="eyebrow">{home.pillars.eyebrow}</p><h2>{home.pillars.heading}</h2></div></div>
        <div className="pillar-grid">{home.pillars.items.map((item, index) => <article className="pillar" key={item.title}><span className="number">0{index + 1} /</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </div>
    </section>
    <section className="publication-section wrap">
      <div className="section-top"><div><p className="eyebrow">{home.reading.eyebrow}</p><h2>{home.reading.heading.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h2></div><Link href="/contents/" className="text-link">{home.reading.contentsLink}</Link></div>
      <div className="edition-notice"><span className="status-dot" /><p>{publicationSummary}</p></div>
      <div className="preview-list">{book.parts.map(part => <Link className="preview-row" href={`/contents/#${part.id}`} key={part.id}><small>{part.number}</small><span>{displayBookTitle(part.title).replace(/^Часть\s+[IVXLC\d]+[.\s:—–-]*/i, "")}</span><span className="arrow" aria-hidden="true">↗</span></Link>)}</div>
      <div className="book-callout"><div><h3>{home.reading.calloutHeading}</h3><p>{home.reading.calloutText}</p></div><Link href="/read/" className="button">{home.reading.cta}</Link></div>
    </section>
    <section className="publication-section wrap">
      <div className="publication-grid">
        <div><p className="eyebrow publication-kicker">{home.library.eyebrow}</p><h2 className="publication-heading">{home.library.heading}</h2></div>
        <div className="publication-prose">{home.library.paragraphs.map(text => <p key={text}>{text}</p>)}<Link className="publication-link" href="/library/">{home.library.cta}</Link></div>
      </div>
    </section>
    <AuthorsGrid compact />
    <section className="publication-section wrap"><div className="publication-grid"><h2 className="publication-heading">{home.closing.heading}</h2><div className="publication-prose"><p>{home.closing.text}</p><Link className="button" href="/read/">{home.closing.cta}</Link></div></div></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replaceAll("<", "\\u003c") }} />
  </main>;
}
