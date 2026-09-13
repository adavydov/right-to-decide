import type { BibliographySource } from '../src/types/library-v10';
export function isLibraryAlias(source: BibliographySource): boolean;
export function visibleLibrarySources(sources: BibliographySource[]): BibliographySource[];
export function libraryAliasTargets(source: BibliographySource, sources: BibliographySource[]): BibliographySource[];
