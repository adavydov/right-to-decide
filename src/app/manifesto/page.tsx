import {notFound} from "next/navigation";
import {siteConfig} from "@/lib/site-config";
import {ManifestoV10, type Manifesto} from "@/components/ManifestoV10";
import data from "@/data/manifesto-v10.json";
export const metadata={title:"Замысел книги",description:"Авторский замысел «Права на решение» и основания работы над книгой.",alternates:{canonical:siteConfig.publicUrl+"/manifesto/"}};
export default function ManifestoPage(){
  if(data.status!=="accepted-public-package")notFound();return <ManifestoV10 data={data as Manifesto}/>;
}
