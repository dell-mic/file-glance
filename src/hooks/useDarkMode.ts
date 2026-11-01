import React from "react"

/**
 * Tracks the `dark` class on <html> (set by the layout bootstrap script and
 * ThemeToggle) via a MutationObserver, so consumers re-render on mode change.
 */
export default function useDarkMode(): boolean {
  const [dark, setDark] = React.useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  )
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])
  return dark
}
