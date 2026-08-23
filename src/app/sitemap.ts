import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteConfig.publicUrl}/`,
      lastModified: new Date("2026-08-23"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
