import type { Metadata } from "next";
import { OpenEditorialNav } from "@/components/OpenEditorialNav";
import { editorialConnected } from "@/lib/open-editorial-mode";
import styles from "@/components/OpenEditorial.module.css";
export const metadata: Metadata = { title: "Открытая редакция будущего", description: "Манифест открытой редакции, чтение, личные заметки и черновики замечаний с привязкой к книге." };
export default async function OpenEditorialLayout({ children }: { children: React.ReactNode }) {
  const content = <main id="main-content" data-editorial-mode={editorialConnected ? "connected" : "static"} className={"wrap " + styles.shell}><p className="eyebrow">Право на решение · Открытая редакция</p><OpenEditorialNav />{children}</main>;
  if (!editorialConnected) return content;
  const { OpenEditorialProvider } = await import("@/components/OpenEditorialProvider");
  return <OpenEditorialProvider>{content}</OpenEditorialProvider>;
}
