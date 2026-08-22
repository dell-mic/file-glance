import type { Metadata, Viewport } from "next"
import { Roboto, Roboto_Mono } from "next/font/google"

import "./globals.css"
import Script from "next/script"
import { longDescription, siteUrl, title } from "@/constants"
import { Toaster } from "../components/ui/toaster"
import { Suspense } from "react"
import { NavigationEvents } from "./navigation-events"

const roboto_mono = Roboto_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto-mono",
})

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | FileGlance",
  },
  description: longDescription,
  keywords: [
    "csv viewer",
    "tsv viewer",
    "xlsx viewer",
    "json viewer",
    "parquet viewer",
    "tabular data",
    "data cleaning",
    "data transformation",
    "privacy-friendly",
    "client-side",
    "JavaScript",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "FileGlance",
    description: longDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FileGlance — view, filter, and transform tabular data files in the browser",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    description: longDescription,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: "#22272b",
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "FileGlance",
  url: siteUrl,
  description: longDescription,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any (web browser)",
  browserRequirements: "Requires JavaScript",
  offers: {
    "@type": "Offer",
    price: 0,
    priceCurrency: "USD",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script id="matomo" strategy="afterInteractive">
          {process.env.NODE_ENV === "production"
            ? `
                var _paq = window._paq = window._paq || [];
                /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
                _paq.push(['disableCookies']);
                // _paq.push(['trackPageView']);
                _paq.push(['enableLinkTracking']);
                (function() {
                  var u="https://piwik.mdell.org/";
                  _paq.push(['setTrackerUrl', u+'matomo.php']);
                  _paq.push(['setSiteId', '10']);
                  var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
                  g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
                })();
                `
            : ""}
        </Script>
      </head>
      <body
        className={`${roboto.className} ${roboto.variable} ${roboto_mono.variable}`}
      >
        <main>{children}</main>
        <Toaster />
        <Suspense fallback={null}>
          <NavigationEvents />
        </Suspense>
      </body>
    </html>
  )
}
