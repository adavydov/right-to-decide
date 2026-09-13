import { BibliographyCatalog } from "@/components/BibliographyCatalog";
import type { Bibliography } from "@/types/library-v10";
import styles from "./BibliographyCatalog.module.css";
export function BibliographyPage({data,preview=false}: {data: Bibliography;preview?: boolean}) {
  return <main id="main-content" className={styles.page}>
    <header className={styles.pageHeader}>
      <p className={styles.kicker}>{preview?"Локальный просмотр":"Читать дальше"}</p><h1>Библиотека</h1>
      <p>Книги, исследования и свидетельства «Права на решение». Найдите источник или мысль, откройте карточки и посмотрите, что они меняют в книге.</p>
    </header>
    <BibliographyCatalog data={data}/>
  </main>;
}
