import {notFound} from "next/navigation";
import {book} from "@/lib/book";
import {siteConfig} from "@/lib/site-config";
import {LegacyManifesto} from "@/components/LegacyManifesto";
import {ManifestoV10, type Manifesto} from "@/components/ManifestoV10";
import data from "@/data/manifesto-v10.json";
export const metadata={title:book.editionVersion==="10.0"?"Манифест":"Манифест и конституция проекта",description:"Авторский замысел «Права на решение» и основания работы над книгой.",alternates:{canonical:siteConfig.publicUrl+"/manifesto/"}};
export default function ManifestoPage(){
  if(book.editionVersion==="10.0"){if(data.status!=="accepted-public-package")notFound();return <ManifestoV10 data={data as Manifesto}/>;}
  return <LegacyManifesto/>;
}
