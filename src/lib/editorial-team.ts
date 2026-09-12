import { book } from "@/lib/book";
import teamV10 from "@/data/editorial-team-v10.json";
import type { PublicEditorialTeam } from "@/types/editorial-v10";
import teamData from "@/data/editorial-team.json";
import authorsData from "@/data/authors.json";
import { siteConfig } from "@/lib/site-config";

// Both visible credits and the machine-readable document use this source.
export const editorialTeam = teamData;
export const editorialTeamUrl = siteConfig.publicUrl + "/authors/#literary-team";
export const editorialTeamDataUrl = siteConfig.publicUrl + "/editorial-team.json";

export function getLegacyEditorialTeamDocument(archived=false) {
  return {
    format: "right-to-decide.editorial-team",
    schemaVersion: 1,
    language: "ru",
    version: editorialTeam.version,
    updated: editorialTeam.updated,
    scope: "editorial-role-catalog",
    description: editorialTeam.roleNote,
    book: { title: siteConfig.title, subtitle: siteConfig.subtitle, url: siteConfig.publicUrl + "/" },
    humanReadableUrl: archived ? siteConfig.publicUrl + "/editions/v9/editorial/#literary-team" : editorialTeamUrl,
    machineReadableUrl: archived ? siteConfig.publicUrl + "/editions/v9/editorial-team.json" : editorialTeamDataUrl,
    humanAuthors: authorsData.authors.map((author) => ({
      id: author.id,
      type: "human",
      name: author.name,
      role: author.role,
      url: siteConfig.publicUrl + "/authors/#author-" + author.id,
    })),
    humanDirection: editorialTeam.humanDirection,
    title: editorialTeam.title,
    intro: editorialTeam.intro,
    conductor: {
      ...editorialTeam.conductor,
      type: "ai-agent-role",
      accountableTo: authorsData.authors.map((author) => author.id),
    },
    groups: editorialTeam.groups.map((group) => ({
      ...group,
      type: "work-area",
      roles: group.roles.map((role) => ({
        ...role,
        type: "ai-agent-role",
        coordinatedBy: editorialTeam.conductor.id,
      })),
    })),
    governance: {
      finalAuthorialDecisions: "human-authors",
      commonVersionEditor: "integrator",
      assignments: "selected-by-task",
      groupMeaning: "Work areas, not additional management levels.",
      ...editorialTeam.principle,
    },
    practicalProject: {
      ...editorialTeam.practicalProject,
      assignments: "not-confirmed",
      roles: editorialTeam.practicalProject.roles.map((role) => ({
        ...role,
        type: "required-human-function",
        assignedTo: null,
      })),
    },
    basis: editorialTeam.basis,
  };
}

export function getEditorialTeamDocument() {
  if(book.editionVersion!=="10.0"||teamV10.status!=="accepted-public-package")return getLegacyEditorialTeamDocument();
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
  const activeTeam=book.editionVersion==="10.0"&&teamV10.status==="accepted-public-package"?teamV10:editorialTeam;
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
