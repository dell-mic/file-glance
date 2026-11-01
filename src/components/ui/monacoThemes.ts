import type { BeforeMount } from "@monaco-editor/react"

// Theme names + definitions shared by all Monaco editors. Themes are global
// in monaco, and any editor mounting without an explicit theme would reset
// the global theme — every MonacoEditor must pass a theme from getEditorTheme.

export const GRAY_THEME = "codeEditorGray"
export const LIGHT_THEME = "codeEditorLight"
export const DARK_THEME = "codeEditorDark"
export const DARK_GRAY_THEME = "codeEditorDarkGray"

export const defineThemes: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(GRAY_THEME, {
    base: "vs",
    inherit: true,
    rules: [],
    // Tailwind gray-100
    colors: { "editor.background": "#F3F4F6" },
  })
  monaco.editor.defineTheme(LIGHT_THEME, {
    base: "vs",
    inherit: true,
    rules: [],
    colors: { "editor.background": "#FFFFFF" },
  })
  // Dark counterparts, matching the .dark palette overrides in globals.css
  monaco.editor.defineTheme(DARK_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: { "editor.background": "#14171C" },
  })
  monaco.editor.defineTheme(DARK_GRAY_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: { "editor.background": "#1D212A" },
  })
}

export function getEditorTheme(grayBackground: boolean, dark: boolean) {
  if (dark) return grayBackground ? DARK_GRAY_THEME : DARK_THEME
  return grayBackground ? GRAY_THEME : LIGHT_THEME
}
