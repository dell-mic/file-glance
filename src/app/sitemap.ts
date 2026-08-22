import { siteUrl } from "@/constants"
import type { MetadataRoute } from "next"

// https://github.com/vercel/next.js/discussions/72221
export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
  // Trailing slashes match `trailingSlash: true` in next.config.mjs
  return [
    {
      url: `${siteUrl}/`,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteUrl}/about/`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ]
}
