import type { Metadata } from "next";
import { BibliographyPage } from "@/components/BibliographyPage";
import { siteConfig } from "@/lib/site-config";
import { sourceLibrary } from "@/lib/library-source-cards";
export const metadata:Metadata={title:"Библиотека",description:"Источники и мысли «Права на решение»: карточки, применение к книге и точный охват чтения.",alternates:{canonical:siteConfig.publicUrl+"/library/"}};
export default function LibraryPage(){
  return <BibliographyPage data={sourceLibrary}/>;
}
