import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";
import { book, readingChapters } from "@/lib/book";
import { cards } from "@/lib/library";
import libraryData from "@/data/library.json";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/contents/",
    "/manifesto/",
    ...["", "manifesto/", "manifesto/history/", "agents/", "agents/guide/", "rules/", "privacy/"].map(path => "/open-editorial/" + path),
    "/authors/",
    "/read/",
    "/library/",
    ...cards.map((card) => "/wiki/" + card.id + "/"),
    ...readingChapters
      .filter((chapter) => chapter.status === "available")
      .map((chapter) => "/read/" + chapter.id + "/"),
  ];
  const lastModified = new Date(
    [book.edition, libraryData.asOf].sort().at(-1)!,
  );
  return [...new Set(routes)].map((route) => ({
    url: siteConfig.publicUrl + route,
    lastModified: route === "/manifesto/" ? new Date("2026-09-06") : lastModified,
    changeFrequency: "monthly" as const,
    priority: route === "/" ? 1 : 0.7,
  }));
}
