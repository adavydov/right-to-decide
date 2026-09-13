import data from "@/data/library-source-cards.json";
import type { Bibliography } from "@/types/library-v10";

/** Only the approved public projection is an input; private cards are not read. */
export const sourceLibrary: Bibliography = data;

export function findLibrarySource(id: string) {
  return sourceLibrary.sources.find(source => source.id === id);
}
