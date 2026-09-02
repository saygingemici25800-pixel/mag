import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // takip sayfaları (/siparis/<uuid>) metadata ile noindex; /siparis/odeme taranabilir kalsın
    rules: [{ userAgent: "*", allow: "/", disallow: ["/panel", "/api/", "/odeme/"] }],
    sitemap: siteUrl() + "/sitemap.xml",
  };
}
