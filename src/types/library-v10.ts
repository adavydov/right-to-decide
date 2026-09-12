export type BibliographySource = {
  id: string; title: string; authors: string[]; edition: string; category: string;
  annotation: string; role: string; cardCount: number;
  reading: {kind: string; label: string; scope: string};
  links: {label: string; url: string}[];
};
export type Bibliography = {
  schemaVersion: number; asOf: string; summary: {records: number; recordsWithCards: number; cards: number};
  readingNote: string; sources: BibliographySource[];
};
