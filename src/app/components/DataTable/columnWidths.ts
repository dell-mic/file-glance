import { sum } from "lodash-es"

export const MinColumnWidthPx = 40
export const MaxColumnWidthPx = 800

const MinGrowthFactor = 1
const MaxGrowthFactor = 1.77

export function estimateColumnWidthPx(valueMaxLength: number): number {
  if (valueMaxLength <= 6) {
    return 64
  } else if (valueMaxLength <= 15) {
    return 128
  } else {
    return 192
  }
}

export function clampColumnWidthPx(width: number): number {
  return Math.min(Math.max(width, MinColumnWidthPx), MaxColumnWidthPx)
}

// Extra room on top of the measured text width: cell padding (p-0.5 = 2px on
// each side) plus a small safety margin
export const ContentFitPaddingPx = 8

// Computes the column width to fit its contents, based on the widest measured
// text (including any extras like the header menu button allowance)
export function computeContentFitWidthPx(maxTextWidthPx: number): number {
  return clampColumnWidthPx(maxTextWidthPx + ContentFitPaddingPx)
}

export interface ColumnWidthComputationInput {
  columns: Array<{ columnIndex: number; valuesMaxLength: number }>
  hiddenColumns: number[]
  customWidths: Record<number, number>
  availableWidthPx: number
}

export interface ColumnWidthComputationResult {
  widths: number[]
  tableWidthPx: number
  isOverFlowingHorizontally: boolean
}

// Computes the effective column widths. Custom (user-resized) widths are
// respected exactly; the growth factor to fill the available width is only
// applied to automatically sized columns.
export function computeColumnWidths({
  columns,
  hiddenColumns,
  customWidths,
  availableWidthPx,
}: ColumnWidthComputationInput): ColumnWidthComputationResult {
  const baseWidths = columns.map((cvc) =>
    !hiddenColumns.includes(cvc.columnIndex)
      ? (customWidths[cvc.columnIndex] ??
        estimateColumnWidthPx(cvc.valuesMaxLength))
      : 0,
  )

  const autoWidthSum = sum(
    columns.map((cvc, i) =>
      customWidths[cvc.columnIndex] == null ? baseWidths[i] : 0,
    ),
  )
  const customWidthSum = sum(baseWidths) - autoWidthSum

  const remainingWidth = availableWidthPx - customWidthSum - autoWidthSum
  const growthFactor =
    autoWidthSum > 0 ? (remainingWidth * 1.0) / autoWidthSum + 1 : 1
  const growFactorEffective = Math.min(
    Math.max(growthFactor, MinGrowthFactor),
    MaxGrowthFactor,
  )

  const widths = columns.map((cvc, i) =>
    customWidths[cvc.columnIndex] == null
      ? baseWidths[i] * growFactorEffective
      : baseWidths[i],
  )

  return {
    widths,
    tableWidthPx: sum(widths),
    isOverFlowingHorizontally: remainingWidth < 0,
  }
}
