import type { Metadata } from "next";
import { LibraryCatalog } from "@/components/LibraryCatalog";
import { availabilityLabels, cards, sources } from "@/lib/library";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Библиотека",
  description:
    "Книги и исследования об инженерии, образовании, искусственном интеллекте и институтах. Сведения об изданиях и доступных материалах.",
  alternates: { canonical: siteConfig.publicUrl + "/library/" },
};

export default function LibraryPage() {
  const cardTitles = Object.fromEntries(cards.map((card) => [card.id, card.title]));

  return (
    <main id="main-content" className="subpage wrap">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Источники для дальнейшего чтения</p>
          <h1 className="page-heading">Библиотека</h1>
          <p className="page-intro">
            Книги и исследования об инженерии, образовании, искусственном
            интеллекте и институтах. Выберите источник, чтобы перейти к сведениям
            об издании и доступным материалам.
          </p>
        </div>
      </div>
      <LibraryCatalog
        items={sources}
        cardTitles={cardTitles}
        cardCount={cards.length}
        availabilityLabels={availabilityLabels}
      />
    </main>
  );
}
