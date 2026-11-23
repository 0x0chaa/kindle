import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/launch", "/about", "/docs", "/terms", "/privacy"];
  return pages.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === "" ? "hourly" : "monthly",
    priority: p === "" ? 1 : 0.6,
  }));
}
