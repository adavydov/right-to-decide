import Link from "next/link";
import {LiteraryTeam} from "@/components/LiteraryTeam";
export const metadata={title:"Литературная команда · архив 9.0"};
export default function ArchiveEditorial(){return <main id="main-content" className="subpage wrap"><p className="eyebrow">Архив редакции 9.0</p><h1 className="page-heading">Команда прежней редакции</h1><p className="page-intro">Сохранённое описание работы над редакцией 9.0 «Права на решение».</p><p><Link href="/authors/#literary-team">К действующей редакции ↗</Link></p><LiteraryTeam archived/></main>;}
