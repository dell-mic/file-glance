import type { Metadata } from "next"
import { Roboto, Roboto_Mono } from "next/font/google"

import "./globals.css"
import Script from "next/script"

const roboto_mono = Roboto_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto-mono",
})

const roboto = Roboto({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
})

export const metadata: Metadata = {
  title: "FileGlance - Viewer for tabular data",
  description:
    "Fast, privacy-friendly viewer for tabular data. Supports CSV, TSV, XLSX, JSON",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <Script id="matomo" strategy="afterInteractive">
          {process.env.NODE_ENV === "production"
            ? `
                var _paq = window._paq = window._paq || [];
                /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
                _paq.push(['trackPageView']);
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
        {children}
      </body>
    </html>
  )
}
