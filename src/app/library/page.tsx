import type { Metadata } from "next";
import { LegacyLibrary } from "@/components/LegacyLibrary";
import { BibliographyPage } from "@/components/BibliographyPage";
import { book } from "@/lib/book";
import { siteConfig } from "@/lib/site-config";
import catalog from "@/data/library-v10.json";
export const metadata:Metadata={title:"Библиотека",description:"Книги, исследования и свидетельства «Права на решение»: аннотации, источники и охват чтения.",alternates:{canonical:siteConfig.publicUrl+"/library/"}};
export default function LibraryPage(){
  if(book.editionVersion==="10.0"&&catalog.status==="accepted-public-package")return <BibliographyPage data={catalog}/>;
  return <LegacyLibrary/>;
}
