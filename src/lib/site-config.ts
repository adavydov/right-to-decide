export const siteConfig = {
  title: "Право на решение",
  subtitle: "Как остаться авторами будущего рядом с более сильным интеллектом",
  description: "Книга о человеческом авторстве будущего рядом с сильным ИИ: как ставить задачи, создавать новое и сохранять возможность менять общий курс.",
  author: "Алексей Михайлович Давыдов",
  email: "letterdam@mail.ru",
  repository: "https://github.com/adavydov/right-to-decide",
  publicUrl: "https://adavydov.github.io/right-to-decide",
  coverPath: "/images/book-cover-contents-v4.png",
  coverWidth: 1024,
  coverHeight: 1536,
  editionLabel: "Рабочая редакция",
} as const;
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export function assetPath(path: string): string {
  return basePath + (path.startsWith("/") ? path : "/" + path);
}
