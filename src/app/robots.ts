import { siteUrl } from "@/constants"
import type { MetadataRoute } from "next"

// https://github.com/vercel/next.js/discussions/72221
export const dynamic = "force-static"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
