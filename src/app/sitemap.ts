import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";
import { readingChapters } from "@/lib/book";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "/",
    "/contents/",
    "/authors/",
    "/read/",
    ...readingChapters
      .filter((c) => c.status === "available")
      .map((c) => "/read/" + c.id + "/"),
  ].map((path) => ({
    url: siteConfig.publicUrl + path,
    lastModified: new Date("2026-09-05"),
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.7,
  }));
}
