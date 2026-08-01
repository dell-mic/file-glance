import { expect, describe, it } from "bun:test"

import { computeNumericStats } from "@/stats"
import { ColumnInfos } from "@/app/components/ValueInspector"

function cv(
  value: any,
  countTotal: number,
  countFiltered: number = countTotal,
): import("@/app/components/ValueInspector").ColumnValues {
  return {
    value,
    originalValue: value,
    preTransformValue: value,
    valueName: String(value),
    valueCountTotal: countTotal,
    valueCountFiltered: countFiltered,
  }
}

function numericColumn(
  name: string,
  values: ReturnType<typeof cv>[],
): ColumnInfos {
  return {
    columnName: name,
    columnIndex: 0,
    columnValues: values,
    valuesMaxLength: name.length,
    isEmptyColumn: false,
    columnType: "Number",
  }
}

describe("computeNumericStats", () => {
  it("computes min/max/avg/median/sum for a known weighted dataset", () => {
    // values: 10 once, 20 twice, 30 three times → [10,20,20,30,30,30]
    const col = numericColumn("x", [cv(10, 1), cv(20, 2), cv(30, 3)])
    const s = computeNumericStats(col)
    expect(s.count).toBe(6)
    expect(s.min).toBe(10)
    expect(s.max).toBe(30)
    expect(s.sum).toBe(140)
    expect(s.avg).toBeCloseTo(140 / 6, 10)
    // sorted length 6 (even) → avg of middle two (index 2,3) = (20+30)/2 = 25
    expect(s.median).toBe(25)
  })

  it("computes median for odd-length weighted set", () => {
    // [5,5,7,9,9] → sorted → middle index 2 = 7
    const col = numericColumn("y", [cv(5, 2), cv(7, 1), cv(9, 2)])
    expect(computeNumericStats(col).median).toBe(7)
  })

  it("returns null stats and empty histogram for an all-empty numeric column (B3 regression)", () => {
    // Everything filtered out (valueCountFiltered = 0)
    const col = numericColumn("empty", [cv(1, 0), cv(2, 0)])
    const s = computeNumericStats(col)
    expect(s.count).toBe(0)
    expect(s.min).toBeNull()
    expect(s.max).toBeNull()
    expect(s.avg).toBeNull()
    expect(s.median).toBeNull()
    expect(s.sum).toBe(0)
    expect(s.histogram).toEqual([])
  })

  it("returns null stats when column values are non-numeric / null", () => {
    const col = numericColumn("n", [cv(Number.NaN, 1), cv(null, 1)])
    const s = computeNumericStats(col)
    expect(s.count).toBe(0)
    expect(s.min).toBeNull()
    expect(s.max).toBeNull()
  })

  it("degenerates to a single bucket when only one distinct value exists (B5 regression)", () => {
    const col = numericColumn("one", [cv(42, 5)])
    const s = computeNumericStats(col)
    expect(s.histogram).toHaveLength(1)
    expect(s.histogram[0].name).toBe("42")
    expect(s.histogram[0].count).toBe(5)
    expect(s.min).toBe(42)
    expect(s.max).toBe(42)
  })

  it("bins values across up to 10 buckets and pins max into the last bucket", () => {
    // 11 distinct values 0..10 → bucketCount min(11,10) = 10
    const values = Array.from({ length: 11 }, (_, i) => cv(i, 1))
    const col = numericColumn("seq", values)
    const s = computeNumericStats(col)
    expect(s.histogram).toHaveLength(10)
    const totalCount = s.histogram.reduce((a, b) => a + b.count, 0)
    expect(totalCount).toBe(11)
    // The max value (10) must land in the last bucket, not overflow.
    expect(s.histogram[s.histogram.length - 1].count).toBeGreaterThanOrEqual(1)
  })

  it("is overflow-safe for a single large group via Max (does not throw RangeError)", () => {
    // A single huge-count value would previously overflow Math.max(...values)
    // and Math.min(...values). Verify it no longer does.
    const col = numericColumn("big", [cv(1, 200_000)])
    const s = computeNumericStats(col)
    expect(s.count).toBe(200_000)
    expect(s.min).toBe(1)
    expect(s.max).toBe(1)
    expect(s.sum).toBe(200_000)
  })

  it("ignores valueCountFiltered === 0 entries", () => {
    const col = numericColumn("mixed", [
      cv(1, 0), // filtered out
      cv(2, 2),
      cv(3, 0), // filtered out
      cv(4, 1),
    ])
    const s = computeNumericStats(col)
    expect(s.count).toBe(3)
    expect(s.min).toBe(2)
    expect(s.max).toBe(4)
    expect(s.sum).toBe(8)
  })
})
