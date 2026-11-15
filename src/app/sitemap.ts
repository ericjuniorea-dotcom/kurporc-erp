import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kurporc.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const hoy = new Date();
  return [
    { url: `${BASE}/`, lastModified: hoy, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/registro`, lastModified: hoy, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/condiciones`, lastModified: hoy, changeFrequency: "monthly", priority: 0.3 },
  ];
}
