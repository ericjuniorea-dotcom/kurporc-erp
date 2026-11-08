import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kurporc.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/registro", "/terminos", "/privacidad", "/legal/"], disallow: ["/api/", "/dashboard", "/cuenta/", "/onboarding", "/vendedor", "/auth/"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
