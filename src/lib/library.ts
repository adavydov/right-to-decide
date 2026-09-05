import libraryData from "@/data/library.json";
import evidenceData from "@/data/evidence-cards.json";
import type {
  EvidenceCard,
  LibraryAvailability,
  LibrarySource,
} from "@/types/library";

/** Public, explicitly curated data. The research corpus is not a runtime input. */
export const sources = libraryData.sources as LibrarySource[];
export const cards = evidenceData.cards as EvidenceCard[];
export const topics = [
  "Становление инженера",
  "Проверка и право возразить",
  "Память и документы",
  "Организация общей работы",
  "Цена результата",
] as const;

export const availabilityLabels: Record<LibraryAvailability, string> = {
  complete: "Полная электронная версия",
  provided: "Предоставленный экземпляр",
  catalog: "Библиографическая запись",
  excerpt: "Доступен фрагмент",
  unavailable: "Полного текста нет",
  "completeness-unverified": "Полнота не подтверждена",
  partial: "Неполная версия",
  "external-only": "Внешняя публикация найдена",
};

export function getCard(id: string): EvidenceCard | undefined {
  return cards.find((card) => card.id === id);
}

export function getSource(id: string): LibrarySource | undefined {
  return sources.find((source) => source.id === id);
}
