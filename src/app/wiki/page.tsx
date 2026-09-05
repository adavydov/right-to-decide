import type { Metadata } from "next";
import { WikiCatalog } from "@/components/WikiCatalog";
import { cards, sources, topics } from "@/lib/library";
import { siteConfig } from "@/lib/site-config";
import styles from "./WikiArticle.module.css";

export const metadata: Metadata = {
  title: "Историческая вики",
  description:
    "Свидетельства из книги В. Г. Грабина «Оружие победы»: фрагменты, контекст и основания для размышления об инженерии, образовании и решениях.",
  alternates: { canonical: siteConfig.publicUrl + "/wiki/" },
};

export default function WikiPage() {
  const catalogCards = cards.map(({ id, sourceId, title, topics, tags, context }) => ({
    id,
    sourceId,
    title,
    topics,
    tags,
    context,
  }));
  const catalogSources = sources
    .filter((source) => cards.some((card) => card.sourceId === source.id))
    .map(({ id, title, authors }) => ({ id, title, authors }));

  return (
    <main id="main-content" className={`subpage wrap ${styles.index}`}>
      <header className={styles.indexHeader}>
        <p className="eyebrow">Историческая вики</p>
        <h1 className={`page-heading ${styles.indexTitle}`}>Исторический опыт в деталях</h1>
        <p className={styles.indexIntro}>
          Свидетельства из книги В. Г. Грабина «Оружие победы»: фрагменты, контекст
          и основания для размышления об инженерии, образовании и решениях.
        </p>
      </header>
      <section className={styles.readingGuide} aria-labelledby="wiki-guide-title">
        <h2 id="wiki-guide-title">Как читать свидетельства</h2>
        <p>
          В каждом материале можно прочитать фрагмент источника, увидеть его
          место в рассказе и проследить связь с вопросами книги. Мемуарное
          свидетельство передаёт взгляд автора; наши выводы и возможный перенос
          к ИИ требуют собственных оснований. Рядом указаны ограничения,
          которые важно сохранить при чтении.
        </p>
      </section>
      <WikiCatalog items={catalogCards} sourceItems={catalogSources} topics={topics} />
    </main>
  );
}
