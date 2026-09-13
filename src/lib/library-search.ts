import type { LibrarySourceCard } from "@/types/library-v10";

export const normalizeLibraryText = (text: string) => text.normalize("NFKC").toLocaleLowerCase("ru").replaceAll("ё", "е");
export const libraryQueryWords = (query: string) => normalizeLibraryText(query).trim().split(/\s+/).filter(Boolean);
export const matchesLibraryWords = (text: string, words: string[]) => words.every(word => normalizeLibraryText(text).includes(word));
export const sourceCardSearchText = (card: LibrarySourceCard) => [card.title, card.idea, card.application, card.mechanism, card.quote?.text].filter(Boolean).join(" ");
export const libraryPlural = (n: number, one: string, few: string, many: string) => n % 100 >= 11 && n % 100 <= 14 ? many : n % 10 === 1 ? one : n % 10 >= 2 && n % 10 <= 4 ? few : many;
