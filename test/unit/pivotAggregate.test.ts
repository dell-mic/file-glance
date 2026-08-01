import { expect, describe, it } from "bun:test"

import { aggregatePivot, buildGroupedBarData, sortPivotResult } from "@/stats"

// Helpers ----------------------------------------------------------------

function row(...vals: any[]): any[] {
  return vals
}

function aggResult(
  data: any[][],
  xIndex: number,
  yIndex: number,
  xName: string,
  yName: string,
  aggregation: Parameters<typeof aggregatePivot>[5],
) {
  return aggregatePivot(data, xIndex, yIndex, xName, yName, aggregation)
    .chartData
}

// aggregatePivot ----------------------------------------------------------

describe("aggregatePivot", () => {
  const data = [
    row("USA", 10),
    row("USA", 20),
    row("USA", 30),
    row("UK", 5),
    row("UK", 15),
    row(null, 999), // x null → skipped
    row("UK", null), // y null → skipped
    row("USA", ""), // y "" → skipped
  ]

  it("Count counts rows per x group", () => {
    const r = aggResult(data, 0, 1, "Country", "Value", "Count")
    const byX = Object.fromEntries(r.map((o) => [o.Country, o.Value]))
    expect(byX).toEqual({ USA: 3, UK: 2 })
  })

  it("Sum sums y per x group (iterative, no spread)", () => {
    const r = aggResult(data, 0, 1, "Country", "Value", "Sum")
    const byX = Object.fromEntries(r.map((o) => [o.Country, o.Value]))
    expect(byX).toEqual({ USA: 60, UK: 20 })
  })

  it("Average averages y per x group", () => {
    const r = aggResult(data, 0, 1, "Country", "Value", "Average")
    const byX = Object.fromEntries(r.map((o) => [o.Country, o.Value]))
    expect(byX).toEqual({ USA: 20, UK: 10 })
  })

  it("Max picks the largest y per x group", () => {
    const r = aggResult(data, 0, 1, "Country", "Value", "Max")
    const byX = Object.fromEntries(r.map((o) => [o.Country, o.Value]))
    expect(byX).toEqual({ USA: 30, UK: 15 })
  })

  it("Min picks the smallest y per x group", () => {
    const r = aggResult(data, 0, 1, "Country", "Value", "Min")
    const byX = Object.fromEntries(r.map((o) => [o.Country, o.Value]))
    expect(byX).toEqual({ USA: 10, UK: 5 })
  })

  it("does not throw RangeError on Max/Min for a single huge group (B2 regression)", () => {
    const big: any[][] = []
    for (let i = 0; i < 200_000; i++) big.push(row("g", i))
    // Previously Math.max(...values) / Math.min(...values) overflowed at ~65–120k.
    expect(() => aggResult(big, 0, 1, "X", "Y", "Max")).not.toThrow()
    expect(() => aggResult(big, 0, 1, "X", "Y", "Min")).not.toThrow()
    const mx = aggResult(big, 0, 1, "X", "Y", "Max")[0].Y
    const mn = aggResult(big, 0, 1, "X", "Y", "Min")[0].Y
    expect(mx).toBe(199_999)
    expect(mn).toBe(0)
  })

  it("downcasts BigInt y values to Number", () => {
    const data2 = [row("a", 10n), row("a", 20n), row("b", 5n)]
    const r = aggResult(data2, 0, 1, "X", "Y", "Sum")
    const byX = Object.fromEntries(r.map((o) => [o.X, o.Y]))
    expect(byX).toEqual({ a: 30, b: 5 })
  })
})

// sortPivotResult ----------------------------------------------------------

describe("sortPivotResult", () => {
  const base = [
    { Country: "USA", Value: 10 },
    { Country: "UK", Value: 20 },
    { Country: "Germany", Value: 5 },
  ]

  it("sorts by the X-Value (string column name) ascending — fixes B1 (Number(key)→NaN)", () => {
    const r = sortPivotResult(base, "X-Value", "asc", "Country", "Value")
    // String comparison asc: Germany, UK, USA
    expect(r.map((o) => o.Country)).toEqual(["Germany", "UK", "USA"])
  })

  it("sorts by the Y-Value descending", () => {
    const r = sortPivotResult(base, "Y-Value", "desc", "Country", "Value")
    expect(r.map((o) => o.Value)).toEqual([20, 10, 5])
  })

  it("returns the array unchanged when sortField is None", () => {
    const r = sortPivotResult(base, "None", "asc", "Country", "Value")
    expect(r.map((o) => o.Country)).toEqual(["USA", "UK", "Germany"])
  })
})

// buildGroupedBarData -----------------------------------------------------

describe("buildGroupedBarData", () => {
  it("builds a 2D contingency table of counts", () => {
    const data = [
      row("USA", "Dog"),
      row("USA", "Cat"),
      row("USA", "Dog"),
      row("UK", "Dog"),
    ]
    const { chartData, groupedYValues } = buildGroupedBarData(
      data,
      (r) => r[0],
      (r) => r[1],
      "Country",
    )
    const byX = Object.fromEntries(chartData.map((o) => [o.Country, o]))
    expect(byX.USA.Dog).toBe(2)
    expect(byX.USA.Cat).toBe(1)
    expect(byX.UK.Dog).toBe(1)
    expect(byX.UK.Cat).toBe(0)
    expect(groupedYValues).toContain("Dog")
    expect(groupedYValues).toContain("Cat")
  })

  it("orders y series by descending total frequency so the largest series survive slicing (B7 regression)", () => {
    // "rare1".."rare5" each appear once; "popular" appears 10 times.
    const data: any[][] = []
    for (let i = 0; i < 10; i++) data.push(row("x", "popular"))
    for (const r of ["rare1", "rare2", "rare3", "rare4", "rare5"])
      data.push(row("x", r))
    const { groupedYValues } = buildGroupedBarData(
      data,
      (r) => r[0],
      (r) => r[1],
      "X",
    )
    // "popular" must come first despite the rares appearing earlier in input.
    expect(groupedYValues[0]).toBe("popular")
  })

  it("skips null / empty x and y", () => {
    const data = [
      row(null, "a"),
      row("", "a"),
      row("x", null),
      row("x", ""),
      row("x", "a"),
    ]
    const { chartData, groupedYValues } = buildGroupedBarData(
      data,
      (r) => r[0],
      (r) => r[1],
      "X",
    )
    expect(chartData).toHaveLength(1)
    expect(chartData[0].X).toBe("x")
    expect(chartData[0].a).toBe(1)
    expect(groupedYValues).toEqual(["a"])
  })
})
