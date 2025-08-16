import type { Metadata } from "next"
import { Roboto, Roboto_Mono } from "next/font/google"

import "./globals.css"
import Script from "next/script"
import { title } from "@/constants"
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
  title: title,
  description:
    "Simple, but powerful, privacy-friendly tool for working with tabular data using JavaScript. Supports CSV, TSV, XLSX, JSON",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://www.fileglance.info" />
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
