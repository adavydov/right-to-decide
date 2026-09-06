"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { editorialConnected } from "@/lib/open-editorial-mode";
import styles from "./OpenEditorial.module.css";
const staticLinks = [["/open-editorial/","Редакция"],["/open-editorial/manifesto/","Манифест"],["/open-editorial/participate/","Черновик замечания"],["/open-editorial/me/","Мои заметки"],["/open-editorial/agents/","Читать со своим ИИ"]];
const connectedLinks = [["/open-editorial/","Редакция"],["/open-editorial/manifesto/","Манифест"],["/open-editorial/discussions/","Обсуждения"],["/open-editorial/tasks/","Исследования"],["/open-editorial/changes/","Изменения"],["/open-editorial/agents/","Ваш ИИ"],["/open-editorial/me/","Мой вклад"]];
export function OpenEditorialNav() { const pathname = usePathname(); return <nav className={styles.nav} aria-label="Открытая редакция">{(editorialConnected ? connectedLinks : staticLinks).map(([href,label]) => <Link key={href} href={href} aria-current={pathname?.replace(/\/$/,"") === href.replace(/\/$/,"") ? "page" : undefined}>{label}</Link>)}</nav>; }
