import Link from "next/link";
import { LibraryCatalog } from "@/components/LibraryCatalog";
import { availabilityLabels, cards, sources } from "@/lib/library";
import spaceLibrary from "@/data/space-library.json";

export function LegacyLibrary({archived=false}: {archived?: boolean}) {
  const catalogCards = cards.map(({ id, sourceId, title, topics, tags, context }) => ({
    id, sourceId, title, topics, tags, context,
  }));

  return (
    <main id="main-content" className="subpage wrap">
      <header className="page-heading-row">
        <div>
          <p className="eyebrow">{archived ? "Библиотека редакции 9.0" : "Читать, исследовать, проверять"}</p>
          <h1 className="page-heading">Библиотека</h1>
          <p className="page-intro">
            От исторического опыта — к устройству будущего. Книги и исследования,
            свидетельства и космические проекты помогают проследить основания
            «Права на решение» и продолжить собственный поиск.
          </p>
        </div>
      </header>
      {archived && <p style={{marginBottom:32}}><Link href="/library/">← Текущая библиотека</Link> · <Link href="/editions/v9/">К редакции 9.0</Link></p>}
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
