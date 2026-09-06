import { Suspense } from "react";
import { editorialConnected } from "@/lib/open-editorial-mode";
import { OpenEditorialModeNotice } from "@/components/OpenEditorialModeNotice";
import styles from "@/components/OpenEditorial.module.css";
export const metadata={title:"История вкладов",robots:{index:false,follow:false}};
export default async function Page(){
 let content=<OpenEditorialModeNotice unavailable="Публичная история принятых вкладов сейчас не включена" />;
 if(editorialConnected){const {OpenEditorialPublicData}=await import("@/components/OpenEditorialPublicData");content=<Suspense fallback={<p role="status">Загрузка…</p>}><OpenEditorialPublicData kind="changes"/></Suspense>;}
 return <><header className={styles.hero}><h1>История вкладов</h1></header><section className={styles.section}>{content}</section></>;
}
