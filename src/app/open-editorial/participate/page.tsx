import { Suspense } from "react";
import { editorialConnected } from "@/lib/open-editorial-mode";
import { OpenEditorialLocalDraft } from "@/components/OpenEditorialLocalDraft";
import styles from "@/components/OpenEditorial.module.css";
export const metadata = { title: "Черновик замечания" };
export default async function Page() {
  let form = <OpenEditorialLocalDraft />;
  if (editorialConnected) { const { OpenEditorialParticipate } = await import("@/components/OpenEditorialParticipate"); form = <OpenEditorialParticipate />; }
  return <><header className={styles.hero}><h1>{editorialConnected ? "Ваше замечание" : "Черновик замечания"}</h1><p className={styles.lead}>{editorialConnected ? "Покажите место и скажите, что стоит проверить." : "Выберите фрагмент, запишите мысль и сохраните её у себя. Здесь нет отправки в редакцию."}</p></header><section className={styles.section}><Suspense fallback={<p role="status">Загрузка привязки к книге…</p>}>{form}</Suspense></section></>;
}
