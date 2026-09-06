import { Suspense } from "react";
import { editorialConnected } from "@/lib/open-editorial-mode";
import { OpenEditorialModeNotice } from "@/components/OpenEditorialModeNotice";
import styles from "@/components/OpenEditorial.module.css";
export const metadata={title:"Участники редакции",robots:{index:false,follow:false}};
export default async function Page(){
 let content=<OpenEditorialModeNotice unavailable="Учётные записи и публичный реестр участников сейчас не подключены" />;
 if(editorialConnected){const {OpenEditorialPublicData}=await import("@/components/OpenEditorialPublicData");content=<Suspense fallback={<p role="status">Загрузка…</p>}><OpenEditorialPublicData kind="participants"/></Suspense>;}
 return <><header className={styles.hero}><h1>Участники редакции</h1></header><section className={styles.section}>{content}</section></>;
}
