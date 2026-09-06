import { Suspense } from "react";
import { editorialConnected } from "@/lib/open-editorial-mode";
import { OpenEditorialModeNotice } from "@/components/OpenEditorialModeNotice";
import styles from "@/components/OpenEditorial.module.css";
export const metadata={title:"Обсуждения",robots:{index:false,follow:false}};
export default async function Page(){
 let content=<OpenEditorialModeNotice unavailable="Публичные обсуждения сейчас не включены" />;
 if(editorialConnected){const {OpenEditorialDiscussions}=await import("@/components/OpenEditorialDiscussions");content=<Suspense fallback={<p role="status">Загрузка…</p>}><OpenEditorialDiscussions/></Suspense>;}
 return <><header className={styles.hero}><h1>Обсуждения</h1></header><section className={styles.section}>{content}</section></>;
}
