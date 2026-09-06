import { Suspense } from "react";
import { editorialConnected } from "@/lib/open-editorial-mode";
import { OpenEditorialModeNotice } from "@/components/OpenEditorialModeNotice";
import styles from "@/components/OpenEditorial.module.css";
export const metadata={title:"Кабинет редакции",robots:{index:false,follow:false}};
export default async function Page(){
 let content=<OpenEditorialModeNotice unavailable="Кабинет редакции сейчас не подключён" />;
 if(editorialConnected){const {OpenEditorialAdmin}=await import("@/components/OpenEditorialAdmin");content=<Suspense fallback={<p role="status">Загрузка…</p>}><OpenEditorialAdmin/></Suspense>;}
 return <><header className={styles.hero}><h1>Кабинет редакции</h1></header><section className={styles.section}>{content}</section></>;
}
