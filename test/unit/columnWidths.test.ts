import { expect, describe, it } from "bun:test"

import {
  clampColumnWidthPx,
  computeColumnWidths,
  estimateColumnWidthPx,
  MinColumnWidthPx,
  MaxColumnWidthPx,
} from "../../src/app/components/DataTable/columnWidths"

const columns = [
  { columnIndex: 0, valuesMaxLength: 3 }, // estimate: 64
  { columnIndex: 1, valuesMaxLength: 10 }, // estimate: 128
  { columnIndex: 2, valuesMaxLength: 30 }, // estimate: 192
]

describe("estimateColumnWidthPx", () => {
  it("estimates width based on max value length", () => {
    expect(estimateColumnWidthPx(0)).toBe(64)
    expect(estimateColumnWidthPx(6)).toBe(64)
    expect(estimateColumnWidthPx(7)).toBe(128)
    expect(estimateColumnWidthPx(15)).toBe(128)
    expect(estimateColumnWidthPx(16)).toBe(192)
  })
})

describe("clampColumnWidthPx", () => {
  it("clamps to min and max", () => {
    expect(clampColumnWidthPx(10)).toBe(MinColumnWidthPx)
    expect(clampColumnWidthPx(10000)).toBe(MaxColumnWidthPx)
    expect(clampColumnWidthPx(200)).toBe(200)
  })
})

describe("computeColumnWidths", () => {
  it("grows columns to fill available width (max 1.77x)", () => {
    // estimates sum: 384; available: 384 * 2 = 768 -> growth 2 clamped to 1.77
    const result = computeColumnWidths({
      columns,
      hiddenColumns: [],
      customWidths: {},
      availableWidthPx: 768,
    })
    expect(result.widths).toEqual([64 * 1.77, 128 * 1.77, 192 * 1.77])
    expect(result.tableWidthPx).toBeCloseTo(384 * 1.77)
    expect(result.isOverFlowingHorizontally).toBe(false)
  })

  it("never shrinks columns below their estimate", () => {
    // available smaller than estimates sum -> growth clamped to 1
    const result = computeColumnWidths({
      columns,
      hiddenColumns: [],
      customWidths: {},
      availableWidthPx: 100,
    })
    expect(result.widths).toEqual([64, 128, 192])
    expect(result.isOverFlowingHorizontally).toBe(true)
  })

  it("gives hidden columns zero width", () => {
    const result = computeColumnWidths({
      columns,
      hiddenColumns: [1],
      customWidths: {},
      availableWidthPx: 100,
    })
    expect(result.widths[1]).toBe(0)
  })

  it("respects custom widths exactly and grows only auto columns", () => {
    // custom: 300 for column 1; auto sum: 64 + 192 = 256
    // available: 300 + 256 * 2 = 812 -> growth 2 clamped to 1.77
    const result = computeColumnWidths({
      columns,
      hiddenColumns: [],
      customWidths: { 1: 300 },
      availableWidthPx: 812,
    })
    expect(result.widths).toEqual([64 * 1.77, 300, 192 * 1.77])
    expect(result.tableWidthPx).toBeCloseTo(300 + 256 * 1.77)
  })

  it("handles all columns being customized", () => {
    const result = computeColumnWidths({
      columns,
      hiddenColumns: [],
      customWidths: { 0: 100, 1: 200, 2: 300 },
      availableWidthPx: 5000,
    })
    expect(result.widths).toEqual([100, 200, 300])
    expect(result.tableWidthPx).toBe(600)
    expect(result.isOverFlowingHorizontally).toBe(false)
  })
})
