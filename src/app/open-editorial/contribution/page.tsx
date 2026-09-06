import { Suspense } from "react";
import { editorialConnected } from "@/lib/open-editorial-mode";
import { OpenEditorialModeNotice } from "@/components/OpenEditorialModeNotice";
import styles from "@/components/OpenEditorial.module.css";
export const metadata={title:"Карточка вклада",robots:{index:false,follow:false}};
export default async function Page(){
 let content=<OpenEditorialModeNotice unavailable="Публичного приёма и карточек вкладов сейчас нет" />;
 if(editorialConnected){const {OpenEditorialContributionDetail}=await import("@/components/OpenEditorialDiscussions");content=<Suspense fallback={<p role="status">Загрузка…</p>}><OpenEditorialContributionDetail/></Suspense>;}
 return <><header className={styles.hero}><h1>Карточка вклада</h1></header><section className={styles.section}>{content}</section></>;
}
