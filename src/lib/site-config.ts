export const siteConfig = {
  title: "Право на решение",
  subtitle: "Инженерное образование как система когнитивного допуска в эпоху искусственного интеллекта",
  description:
    "Публичный проспект будущей монографии Алексея Михайловича Давыдова о том, как формировать и доказывать инженерную готовность в эпоху искусственного интеллекта.",
  author: "Алексей Михайлович Давыдов",
  email: "letterdam@mail.ru",
  repository: "https://github.com/adavydov/right-to-decide",
  publicUrl: "https://adavydov.github.io/right-to-decide",
} as const;

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function assetPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalized}`;
}

