// Chart color palette for consistent chart coloring
export const CHART_SERIES_COLORS = [
  "#7eb0d5",
  "#b2e061",
  "#bd7ebe",
  "#ffb55a",
  "#ffee65",
  "#beb9db",
  "#fdcce5",
  "#8bd3c7",
  "#fd7f6f",
]

export const CHART_LABELS_COLORS = CHART_SERIES_COLORS.map((c) =>
  darkenHexColor(c, 0.15),
)

export const ChartAnimationDuration = 250

export const EMPTY_LABEL = "(empty)"

export function darkenHexColor(hex: string, percent: number): string {
  // Remove hash if present
  hex = hex.replace(/^#/, "")
  // Parse r, g, b
  let num = parseInt(hex, 16)
  let r = (num >> 16) & 0xff
  let g = (num >> 8) & 0xff
  let b = num & 0xff
  // Decrease each channel
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))))
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))))
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))))
  // Convert back to hex
  return (
    "#" +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  )
}
