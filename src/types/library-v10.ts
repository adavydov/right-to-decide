export type LibrarySourceCard = {
  id: string; title: string; idea: string; application: string; locator: string;
  mechanism?: string; limits?: string[];
  quote?: {text: string; attribution: string; locator: string};
};
export type BibliographySource = {
  id: string; title: string; authors: string[]; edition: string; category: string;
  annotation: string; role: string; cardCount: number;
  reading: {kind: string; label: string; scope: string};
  links: {label: string; url: string}[];
  sourceNote?: string;
  cards?: LibrarySourceCard[];
};
export type Bibliography = {
  schemaVersion: number; asOf: string; summary: {records: number; recordsWithCards: number; cards: number};
  readingNote: string; cardNote?: string; sources: BibliographySource[];
};
