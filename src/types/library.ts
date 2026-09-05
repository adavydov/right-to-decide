export type LibraryAvailability = "complete" | "provided" | "catalog" | "excerpt" | "unavailable" | "completeness-unverified" | "partial" | "external-only";
export type LibrarySource = {
  id: string; number: number; title: string; authors: string[]; contributors?: string[];
  category: string; edition: string; languages: string[]; materialNote: string;
  availability: LibraryAvailability; reading: "not-claimed" | "documented-text-reading"; readingNote?: string;
  links: {label: string; url: string; kind: "publisher" | "catalog" | "text" | "excerpt" | "archive"; note?: string}[];
  cardIds: string[];
};
export type EvidenceQuote = {text: string; attribution: string; paragraphIds: string[]};
export type EvidenceCard = {
  id: string; sourceId: string; title: string; topics: string[]; tags: string[];
  sections: string[]; paragraphIds: string[]; context: string; observation: string; interpretation: string;
  quotes: EvidenceQuote[]; capability: string; workProcedure: string; limits: string[];
  review: {date: string; sourceCorrespondence: "checked"; historicalCorroboration: "not-established"; note: string};
};
export type PublicLibrary = {schemaVersion: 1; asOf: string; sources: LibrarySource[]; cards: EvidenceCard[]};
