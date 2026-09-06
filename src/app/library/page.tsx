import type { Metadata } from "next";
import { LibraryCatalog } from "@/components/LibraryCatalog";
import { availabilityLabels, cards, sources } from "@/lib/library";
import { siteConfig } from "@/lib/site-config";
import spaceLibrary from "@/data/space-library.json";

export const metadata: Metadata = {
  title: "Библиотека",
  description:
    "Книги, исследования, исторические свидетельства и космические проекты «Права на решение» — в одной библиотеке с общим поиском.",
  alternates: { canonical: siteConfig.publicUrl + "/library/" },
};

export default function LibraryPage() {
  const catalogCards = cards.map(({ id, sourceId, title, topics, tags, context }) => ({
    id, sourceId, title, topics, tags, context,
  }));

  return (
    <main id="main-content" className="subpage wrap">
      <header className="page-heading-row">
        <div>
          <p className="eyebrow">Читать, исследовать, проверять</p>
          <h1 className="page-heading">Библиотека</h1>
          <p className="page-intro">
            От исторического опыта — к устройству будущего. Книги и исследования,
            свидетельства и космические проекты помогают проследить основания
            «Права на решение» и продолжить собственный поиск.
          </p>
        </div>
      </header>
      <LibraryCatalog
        items={sources}
        cards={catalogCards}
        spaceSources={spaceLibrary.sources}
        projects={spaceLibrary.projects}
        availabilityLabels={availabilityLabels}
        spaceNote={spaceLibrary.note}
      />
    </main>
  );
}
