"use client"

import { Moon, Sun } from "lucide-react"

const STORAGE_KEY = "theme"

/** Resolved dark state: stored manual choice wins, otherwise system setting. */
export function resolveDark(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark") return stored === "dark"
  } catch {
    // localStorage unavailable (e.g. blocked cookies) — fall through to system
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

/** Applies the resolved mode to <html>. Also runs on system change while unset. */
export function applyResolvedTheme() {
  const dark = resolveDark()
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
  return dark
}

export function storeTheme(dark: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light")
  } catch {
    // Ignore: without storage we simply fall back to the system setting
  }
}

/**
 * Small icon button to manually override the color mode. Icons are swapped
 * via CSS (`dark:`) so the server-rendered markup never mismatches.
 */
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
      className={`bg-transparent align-bottom self-center text-gray-500 rounded-full p-1 hover:bg-gray-200 hover:text-gray-700 transition-colors duration-200 cursor-pointer ${className ?? ""}`}
      onClick={() => {
        storeTheme(!resolveDark())
        applyResolvedTheme()
      }}
    >
      <Moon className="w-4 h-4 hidden dark:block" />
      <Sun className="w-4 h-4 block dark:hidden" />
    </button>
  )
}
