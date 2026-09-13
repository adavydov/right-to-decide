import siteCopy from "../data/site-copy.json" with { type: "json" };

export const siteConfig = {
  title: "Право на решение",
  subtitle: "Чего мы захотим, когда получим всё",
  description: siteCopy.home.metadataDescription,
  author: "Алексей Михайлович Давыдов",
  email: "letterdam@mail.ru",
  repository: "https://github.com/adavydov/right-to-decide",
  publicUrl: "https://adavydov.github.io/right-to-decide",
  coverPath: "/images/book-cover-v10-1.png",
  coverWidth: 1024,
  coverHeight: 1536,
  editionLabel: "Рабочая редакция",
} as const;
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export function assetPath(path: string): string {
  return basePath + (path.startsWith("/") ? path : "/" + path);
}
