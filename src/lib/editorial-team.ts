import teamV10 from "@/data/editorial-team-v10.json";
import type { PublicEditorialTeam } from "@/types/editorial-v10";
import authorsData from "@/data/authors.json";
import { siteConfig } from "@/lib/site-config";

// Both visible credits and the machine-readable document use this source.
export const editorialTeam = teamV10 as PublicEditorialTeam;
export const editorialTeamUrl = siteConfig.publicUrl + "/authors/#literary-team";
export const editorialTeamDataUrl = siteConfig.publicUrl + "/editorial-team.json";

export function getEditorialTeamDocument() {
  const team=teamV10 as PublicEditorialTeam;
  return {format:"right-to-decide.editorial-team",schemaVersion:1,language:"ru",version:team.version,updated:team.updated,scope:"editorial-role-catalog",
    title:team.title,intro:team.intro,description:team.roleNote,
    book:{title:siteConfig.title,subtitle:siteConfig.subtitle,url:siteConfig.publicUrl+"/"},
    humanReadableUrl:editorialTeamUrl,machineReadableUrl:editorialTeamDataUrl,
    humanAuthors:authorsData.authors.map(a=>({id:a.id,type:"human",name:a.name,role:a.role,url:siteConfig.publicUrl+"/authors/#author-"+a.id})),
    humanDirection:team.humanDirection,
    roles:team.roles.map(r=>({...r,type:"ai-agent-role"})),workflow:team.workflow,
    governance:{finalAuthorialDecisions:"human-authors",commonVersionEditor:"integrator",independentReading:true,assignments:"role-catalog-only"}};
}

export function getBookCreditsStructuredData() {
  const activeTeam=editorialTeam;
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": siteConfig.publicUrl + "/#book",
    name: siteConfig.title,
    alternateName: siteConfig.subtitle,
    inLanguage: "ru",
    isAccessibleForFree: true,
    url: siteConfig.publicUrl + "/",
    image: siteConfig.publicUrl + siteConfig.coverPath,
    author: authorsData.authors.map((author) => ({
      "@type": "Person",
      "@id": siteConfig.publicUrl + "/authors/#author-" + author.id,
      name: author.name,
    })),
    creditText: activeTeam.intro,
    contributor: {
      "@type": "Organization",
      "@id": editorialTeamUrl,
      name: activeTeam.title + " «Права на решение»",
      description: activeTeam.intro + " " + activeTeam.roleNote,
      url: editorialTeamUrl,
      subjectOf: {
        "@type": "DigitalDocument",
        name: "Авторы и литературные ИИ-агенты: роли и дирижирование",
        encodingFormat: "application/json",
        url: editorialTeamDataUrl,
      },
    },
  };
}
