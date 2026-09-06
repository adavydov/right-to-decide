import { Suspense } from "react";
import { editorialConnected } from "@/lib/open-editorial-mode";
import { OpenEditorialModeNotice } from "@/components/OpenEditorialModeNotice";
import styles from "@/components/OpenEditorial.module.css";
export const metadata={title:"Исследования",robots:{index:false,follow:false}};
export default async function Page(){
 let content=<OpenEditorialModeNotice unavailable="Каталог редакционных исследований сейчас не включён" />;
 if(editorialConnected){const {OpenEditorialPublicData}=await import("@/components/OpenEditorialPublicData");content=<Suspense fallback={<p role="status">Загрузка…</p>}><OpenEditorialPublicData kind="tasks"/></Suspense>;}
 return <><header className={styles.hero}><h1>Исследования</h1></header><section className={styles.section}>{content}</section></>;
}
