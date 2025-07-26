"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function NavigationEvents() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // console.log(pathname, searchParams)
    const url = `${pathname}${
      searchParams.size ? "?" + searchParams.toString() : ""
    }`
    // eslint-disable-next-line no-console
    // console.log('Naviation triggered:', url)

    if (window && window._paq) {
      window._paq.push(["setCustomUrl", url])
      window._paq.push(["setDocumentTitle", document.title])
      window._paq.push(["trackPageView"])
    }
  }, [pathname, searchParams])

  return null
}
