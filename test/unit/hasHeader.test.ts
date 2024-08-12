import { expect, describe, it } from "bun:test"

import { hasHeader } from "@/utils"

describe("hasHeader", () => {
  it("should return true when the first row is a header", () => {
    const data = [
      ["Name", "Age", "City"],
      ["Alice", "30", "New York"],
      ["Bob", "25", "Los Angeles"],
      ["Charlie", "35", "Chicago"],
      ["David", "28", "Houston"],
      ["Eve", "22", "Phoenix"],
    ]

    const result = hasHeader(data)
    expect(result).toBe(true)
  })

  it("should return false when the first row is part of the data", () => {
    const data = [
      ["Alice", "30", "New York"],
      ["Bob", "25", "Los Angeles"],
      ["Charlie", "35", "Chicago"],
      ["David", "28", "Houston"],
      ["Eve", "22", "Phoenix"],
      ["Frank", "40", "Miami"],
    ]

    const result = hasHeader(data)
    expect(result).toBe(false)
  })

  it("should return false when the data rows are too similar to the first row", () => {
    const data = [
      ["1", "1", "1"],
      ["1", "1", "1"],
      ["1", "1", "1"],
      ["1", "1", "1"],
      ["1", "1", "1"],
      ["1", "1", "1"],
    ]

    const result = hasHeader(data)
    expect(result).toBe(false)
  })

  it("should return true when the first row is clearly a header with distinct column names", () => {
    const data = [
      ["Firstname", "Lastname"],
      ["John", "Doe"],
      ["Jane", "Smith"],
      ["Emily", "Jones"],
      ["Michael", "Brown"],
      ["Chris", "Wilson"],
    ]

    const result = hasHeader(data)
    expect(result).toBe(true)
  })
})
