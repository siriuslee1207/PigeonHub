import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/data/members";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/members`, changeFrequency: "monthly", priority: 0.8 },
    ...getAllSlugs().map((slug) => ({
      url: `${siteUrl}/members/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
