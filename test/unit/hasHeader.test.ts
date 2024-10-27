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

  it("return false when there are repating values in first row (as almost always are values then)", () => {
    const data = [
      ["value1", "value1", "some-other-stuff"],
      ["value1", "value1", "value2"],
      ["value1", "value1", "value2"],
    ]

    const result = hasHeader(data)
    expect(result).toBe(false)
  })

  it("return false when a 'header;  value is also part of data", () => {
    const data = [
      ["value1", "value2", "some-other-stuff"],
      ["value1", "value1", "value2"],
      ["value1", "value1", "value2"],
    ]

    const result = hasHeader(data)
    expect(result).toBe(false)
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

  it("should return false when the first row is part of the data (also when single values of first row have bigger string distance)", () => {
    const data = [
      [
        2,
        "Robert Harris",
        31,
        "robertharris@example.com",
        "555-3573",
        "UK",
        "Calgary",
        "Manager",
        50811,
        3,
        "❤️",
        "2023-08-22",
        713.0,
        "Green",
        true,
        3,
        "Japanese",
        "Close to retirement",
      ],
      [
        3,
        "Michael Scott",
        41,
        "michaelscott@example.com",
        "555-5854",
        "Australia",
        "Canberra",
        "Accountant",
        120680,
        5,
        "📰",
        "2023-03-18",
        320.0,
        "Green",
        true,
        0,
        "Italian",
        "",
      ],
      [
        4,
        "Laura Lee",
        42,
        "lauralee@example.com",
        "555-9761",
        "Canada",
        "Edinburgh",
        "Manager",
        57797,
        3,
        "🎉",
        "2019-08-10",
        820.0,
        "Yellow",
        true,
        0,
        "French",
        "",
      ],
      [
        5,
        "Sophia Martinez",
        43,
        "sophiamartinez@example.com",
        "555-5040",
        "UK",
        "San Francisco",
        "Accountant",
        70608,
        3,
        "🎉",
        "2022-09-20",
        689.0,
        "Pink",
        false,
        4,
        "Italian",
        "",
      ],
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

  it("should return true when the first row with distinct column names", () => {
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
