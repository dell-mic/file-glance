import type { Metadata } from "next"
import { Roboto, Roboto_Mono } from "next/font/google"

import "./globals.css"

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
      <body
        className={`${roboto.className} ${roboto.variable} ${roboto_mono.variable}`}
      >
        {children}
      </body>
    </html>
  )
}
