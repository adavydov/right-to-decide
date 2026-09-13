import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";
import { book, readingChapters } from "@/lib/book";
import libraryData from "@/data/library-source-cards.json";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/essence/",
    "/contents/",
    "/manifesto/",
    ...["", "manifesto/", "manifesto/history/", "agents/", "agents/guide/", "rules/", "privacy/"].map(path => "/open-editorial/" + path),
    "/authors/",
    "/read/",
    "/library/",
    ...libraryData.sources.map((source) => "/library/" + source.id + "/"),
    "/research/v10/",
    ...readingChapters
      .filter((chapter) => chapter.status === "available")
      .map((chapter) => "/read/" + chapter.id + "/"),
  ];
  const lastModified = new Date(
    [book.edition, libraryData.asOf].sort().at(-1)!,
  );
  return [...new Set(routes)].map((route) => ({
    url: siteConfig.publicUrl + route,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: route === "/" ? 1 : 0.7,
  }));
}
