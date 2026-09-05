import teamData from "@/data/editorial-team.json";
import authorsData from "@/data/authors.json";
import { siteConfig } from "@/lib/site-config";

// Both visible credits and the machine-readable document use this source.
export const editorialTeam = teamData;
export const editorialTeamUrl = siteConfig.publicUrl + "/authors/#literary-team";
export const editorialTeamDataUrl = siteConfig.publicUrl + "/editorial-team.json";

export function getEditorialTeamDocument() {
  return {
    format: "right-to-decide.editorial-team",
    schemaVersion: 1,
    language: "ru",
    version: editorialTeam.version,
    updated: editorialTeam.updated,
    scope: "editorial-role-catalog",
    description: editorialTeam.roleNote,
    book: { title: siteConfig.title, subtitle: siteConfig.subtitle, url: siteConfig.publicUrl + "/" },
    humanReadableUrl: editorialTeamUrl,
    machineReadableUrl: editorialTeamDataUrl,
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

export function getBookCreditsStructuredData() {
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
    creditText: editorialTeam.intro,
    contributor: {
      "@type": "Organization",
      "@id": editorialTeamUrl,
      name: editorialTeam.title + " «Права на решение»",
      description: editorialTeam.intro + " " + editorialTeam.roleNote,
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
