// Chart color palette for consistent chart coloring

export const CHART_COLOR_RED = "#fd7f6f" // coral red
export const CHART_COLOR_GREEN = "#b2e061" // light lime green
export const CHART_COLOR_EMPTY = "#c2c2c2" // neutral gray
export const CHART_LABEL_EMPTY = darkenHexColor(CHART_COLOR_EMPTY, 0.3) // Slight darker for better readability

export const CHART_COLOR_OTHERS = "#E5E7EB"
export const CHART_LABEL_OTHERS = darkenHexColor(CHART_COLOR_OTHERS, 0.3) // Slight darker for better readability

export const CHART_SERIES_COLORS = [
  "#7eb0d5", // sky blue
  "#ffb55a", // amber / orange
  "#bd7ebe", // orchid purple
  "#8bd3c7", // mint teal
  "#fdcce5", // light pink
  "#ffee65", // lemon yellow
  "#beb9db", // lavender
  "#ffd1a6", // pastel apricot
  "#c1f0ea", // pastel aqua
  // IMPORTANT that those two come last for boolean/semantic color picking
  CHART_COLOR_GREEN,
  CHART_COLOR_RED,
]

export const CHART_LABELS_COLORS = CHART_SERIES_COLORS.map((c) =>
  darkenHexColor(c, 0.15),
)

export const ChartAnimationDuration = 250

export const EMPTY_LABEL = "(empty)"

/**
 * Mode-aware chart palette. The pastel series colors read well on both light
 * and dark surfaces. In dark mode the light "Other"/"(empty)" neutrals get
 * dark tints, and slice labels use the series colors directly instead of the
 * darkened label colors (which would be unreadable on dark surfaces).
 */
export function getChartColors(dark: boolean) {
  if (!dark) {
    return {
      series: CHART_SERIES_COLORS,
      labels: CHART_LABELS_COLORS,
      others: CHART_COLOR_OTHERS,
      othersLabel: CHART_LABEL_OTHERS,
      empty: CHART_COLOR_EMPTY,
      emptyLabel: CHART_LABEL_EMPTY,
    }
  }
  // Fills are deepened versions of the pastels (pastels read as neon on dark
  // surfaces); labels stay at the original brighter tones for readability.
  const series = CHART_SERIES_COLORS.map((c) => darkenHexColor(c, 0.15))
  return {
    series,
    labels: CHART_SERIES_COLORS,
    others: "#3a3f47",
    othersLabel: "#9ca3af",
    empty: "#4a4f58",
    emptyLabel: "#9ca3af",
  }
}

export function darkenHexColor(hex: string, percent: number): string {
  // Remove hash if present
  hex = hex.replace(/^#/, "")
  // Parse r, g, b
  const num = parseInt(hex, 16)
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
