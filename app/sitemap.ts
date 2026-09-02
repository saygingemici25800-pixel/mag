import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "@/lib/i18n";
import { LEGAL_SLUGS } from "@/lib/legal";
import { siteUrl } from "@/lib/site";

const PATHS: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, freq: "weekly" },
  { path: "/siparis", priority: 0.9, freq: "weekly" },
  ...LEGAL_SLUGS.map((s) => ({ path: `/yasal/${s}`, priority: 0.2, freq: "yearly" as const })),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return PATHS.flatMap(({ path, priority, freq }) =>
    LOCALES.map((l) => ({
      url: base + localePath(l, path),
      lastModified: now,
      changeFrequency: freq,
      priority,
      alternates: { languages: { tr: base + localePath("tr", path), en: base + localePath("en", path) } },
    })),
  );
}
