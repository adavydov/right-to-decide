import { notFound } from "next/navigation";
import { BibliographyPage } from "@/components/BibliographyPage";
import data from "@/data/library-v10.json";
export const metadata={title:"Локальный просмотр библиотеки",robots:{index:false,follow:false}};
export default function Preview(){
  if(process.env.V10_PUBLIC_PREVIEW!=="1")notFound();
  return <BibliographyPage data={data} preview/>;
}
