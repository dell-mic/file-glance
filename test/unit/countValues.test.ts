import { expect, describe, it } from "bun:test"

import { countValues } from "@/utils"

describe("countValues", () => {
  it("counts basic value occurrences per column", () => {
    const headers = ["col"]
    const input = [["a"], ["b"], ["a"]]
    const infos = countValues(headers, input, input)
    const counts = infos[0].columnValues
    expect(counts).toHaveLength(2)
    expect(counts.find((cv) => cv.valueName === "a")?.valueCountTotal).toBe(2)
    expect(counts.find((cv) => cv.valueName === "b")?.valueCountTotal).toBe(1)
  })

  it("counts values that collide with Object.prototype property names", () => {
    const headers = ["col"]
    const input = [
      ["__proto__"],
      ["constructor"],
      ["toString"],
      ["normal"],
      ["normal"],
    ]
    const infos = countValues(headers, input, input)
    const counts = infos[0].columnValues
    expect(counts).toHaveLength(4)
    expect(
      counts.find((cv) => cv.valueName === "__proto__")?.valueCountTotal,
    ).toBe(1)
    expect(
      counts.find((cv) => cv.valueName === "constructor")?.valueCountTotal,
    ).toBe(1)
    expect(
      counts.find((cv) => cv.valueName === "toString")?.valueCountTotal,
    ).toBe(1)
    expect(
      counts.find((cv) => cv.valueName === "normal")?.valueCountTotal,
    ).toBe(2)
  })

  it("does not pollute Object.prototype", () => {
    countValues(["col"], [["__proto__"]], [["__proto__"]])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).valueCountTotal).toBeUndefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).valueCountFiltered).toBeUndefined()
  })
})
