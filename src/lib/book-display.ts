export function displayBookTitle(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean !== clean.toLocaleUpperCase("ru")) return clean;
  return (clean.charAt(0) + clean.slice(1).toLocaleLowerCase("ru"))
    .replace(/(?<![а-яё])(ии|рут|миит|ссср|рф)(?![а-яё])/gu, (m) => m.toLocaleUpperCase("ru"))
    .replace(/\b(cdio|stem|abet|llm|mit)\b/g, (m) => m.toUpperCase())
    .replace(/^Часть ([ivxlcdm]+)\./, (_, n: string) => "Часть " + n.toUpperCase() + ".")
    .replace(/^(Приложение )([а-яё])\./u, (_, prefix: string, n: string) => prefix + n.toUpperCase() + ".")
    .replace(/^((?:Глава \d+|Часть [IVXLCDM]+|Приложение [А-ЯЁ])\.\s*)([а-яёa-z])/u, (_, prefix: string, letter: string) => prefix + letter.toUpperCase())
    .replace(/^(\d+(?:\.\d+)*\.?\s+)([а-яёa-z])/u, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
}
export type ChapterNavigation = {
  id: string;
  title: string;
  part: string | null;
  kind: string;
  number: number | string | null;
  status: string;
  minutes: number;
  headings?: string[];
  docx?: string;
};
