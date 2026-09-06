import { editorialConnected } from "@/lib/open-editorial-mode";
import { OpenEditorialLocalNotes } from "@/components/OpenEditorialLocalNotes";
import styles from "@/components/OpenEditorial.module.css";
export const metadata = { title: "Мои заметки", robots: { index: false, follow: false } };
export default async function Page() {
  let content = <OpenEditorialLocalNotes />;
  if (editorialConnected) { const { OpenEditorialAccount } = await import("@/components/OpenEditorialAccount"); content = <OpenEditorialAccount />; }
  return <><header className={styles.hero}><h1>{editorialConnected ? "Мой вклад" : "Мои заметки"}</h1><p className={styles.lead}>{editorialConnected ? "Личные материалы и судьба ваших предложений." : "Личные записи в этом браузере. Их можно изменить, скачать или превратить в отдельный локальный черновик."}</p></header><section className={styles.section}>{content}</section></>;
}
