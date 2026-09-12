import {notFound} from "next/navigation";
import team from "@/data/editorial-team-v10.json";
import {PublicEditorialTeam} from "@/components/PublicEditorialTeam";
export const metadata={title:"Локальный просмотр литературной редакции",robots:{index:false,follow:false}};
export default function Preview(){
  if(process.env.V10_PUBLIC_PREVIEW!=="1"||team.roles.length!==13)notFound();
  return <main id="main-content" className="subpage wrap"><p className="eyebrow">Локальный просмотр</p><h1 className="page-heading">Работа над книгой</h1><PublicEditorialTeam team={team}/></main>;
}
