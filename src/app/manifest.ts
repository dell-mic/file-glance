import { description } from "@/constants"
import type { MetadataRoute } from "next"

// https://github.com/vercel/next.js/discussions/72221
export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FileGlance",
    short_name: "FileGlance",
    description: description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#22272b",
    orientation: "any",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
