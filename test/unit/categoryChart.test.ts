import { expect, describe, it } from "bun:test"

import { buildCategoryChartData } from "@/stats"
import { ColumnInfos } from "@/app/components/ValueInspector"

function catCv(
  name: string,
  countTotal: number,
  countFiltered: number = countTotal,
) {
  return {
    value: name,
    originalValue: name,
    preTransformValue: name,
    valueName: name,
    valueCountTotal: countTotal,
    valueCountFiltered: countFiltered,
  }
}

function catColumn(values: ReturnType<typeof catCv>[]): ColumnInfos {
  return {
    columnName: "cat",
    columnIndex: 0,
    columnValues: values,
    valuesMaxLength: 3,
    isEmptyColumn: false,
    columnType: "String",
  }
}

describe("buildCategoryChartData", () => {
  it("keeps top N values and groups the rest into 'Other' when there are >= 2 others", () => {
    const vals = Array.from({ length: 12 }, (_, i) => catCv(`v${i}`, 12 - i))
    const { data, otherSum, otherCount, total } = buildCategoryChartData(
      catColumn(vals),
      10,
      true,
    )
    expect(data).toHaveLength(11)
    expect(otherCount).toBe(2)
    expect(otherSum).toBe(2 + 1)
    expect(data[data.length - 1].name).toBe("Other")
    expect(data[data.length - 1].value).toBe(3)
    expect(total).toBe(12 + 11 + 10 + 9 + 8 + 7 + 6 + 5 + 4 + 3 + 2 + 1)
  })

  it("does NOT group a single 'other' value into 'Other'", () => {
    const vals = Array.from({ length: 11 }, (_, i) => catCv(`v${i}`, 11 - i))
    const { data, otherCount, otherSum } = buildCategoryChartData(
      catColumn(vals),
      10,
      true,
    )
    expect(data).toHaveLength(11)
    expect(otherCount).toBe(1)
    expect(otherSum).toBe(1)
    expect(data.some((d) => d.name === "Other")).toBe(false)
  })

  it("computes percentage of total including 'Other' bucket", () => {
    const vals = [catCv("a", 60), catCv("b", 30), catCv("c", 10)]
    const { data, total } = buildCategoryChartData(catColumn(vals), 10, true)
    expect(total).toBe(100)
    const a = data.find((d) => d.name === "a")!
    expect(a.percentage).toBeCloseTo(60, 10)
    const c = data.find((d) => d.name === "c")!
    expect(c.percentage).toBeCloseTo(10, 10)
  })

  it("guards percentage division by zero when total is 0", () => {
    const vals = [catCv("a", 0), catCv("b", 0)]
    const { data, total } = buildCategoryChartData(catColumn(vals), 10, true)
    expect(total).toBe(0)
    for (const d of data) expect(d.percentage).toBe(0)
  })

  it("ignores values with valueCountFiltered === 0", () => {
    const vals = [catCv("a", 50, 0), catCv("b", 30, 30), catCv("c", 20, 20)]
    const { data, total } = buildCategoryChartData(catColumn(vals), 10, true)
    expect(total).toBe(50)
    expect(data.map((d) => d.name)).toEqual(["b", "c"])
  })

  it("sorts values by descending filtered count", () => {
    const vals = [catCv("rare", 1), catCv("common", 100), catCv("mid", 10)]
    const { data } = buildCategoryChartData(catColumn(vals), 10, true)
    expect(data.map((d) => d.name)).toEqual(["common", "mid", "rare"])
  })
})
