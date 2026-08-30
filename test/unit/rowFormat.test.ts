import { expect, describe, it } from "bun:test"

import { rowToTsv, rowToJson, rowToKeyValuePairs, valueTypeName } from "@/utils"

const headerRow = ["Name", "Age", "Active", "Note"]

describe("rowToTsv", () => {
  it("joins values with tabs, emptying null/undefined", () => {
    expect(rowToTsv(["John", 29, true, null])).toBe("John\t29\ttrue\t")
  })

  it("flattens arrays with commas", () => {
    expect(rowToTsv(["x", ["a", "b"], "y"])).toBe("x\ta,b\ty")
  })
})

describe("rowToJson", () => {
  it("maps headers to values (duplicate headers: last wins), pretty-printed", () => {
    expect(rowToJson(headerRow, ["John", 29, false, "x"])).toBe(`{
  "Name": "John",
  "Age": 29,
  "Active": false,
  "Note": "x"
}`)
  })

  it("keeps null for null values", () => {
    expect(rowToJson(headerRow, ["John", 29, true, null])).toBe(`{
  "Name": "John",
  "Age": 29,
  "Active": true,
  "Note": null
}`)
  })

  it("stringifies bigint values instead of throwing", () => {
    expect(
      rowToJson(headerRow, ["John", BigInt("9007199254740993"), true, "x"]),
    ).toBe(`{
  "Name": "John",
  "Age": "9007199254740993",
  "Active": true,
  "Note": "x"
}`)
  })
})

describe("rowToKeyValuePairs", () => {
  it("formats header: value pairs, one per line", () => {
    expect(rowToKeyValuePairs(headerRow, ["John", 29, true, null])).toBe(
      "Name: John\nAge: 29\nActive: true\nNote: ",
    )
  })

  it("flattens arrays like the TSV format", () => {
    expect(rowToKeyValuePairs(["Tags"], [["a", "b"]])).toBe("Tags: a,b")
  })
})

describe("valueTypeName", () => {
  it("reports null/undefined explicitly", () => {
    expect(valueTypeName(null)).toBe("null")
    expect(valueTypeName(undefined)).toBe("undefined")
  })

  it("reports String for strings", () => {
    expect(valueTypeName("hello")).toBe("String")
  })

  it("reports constructor name for typed values", () => {
    expect(valueTypeName(42)).toBe("Number")
    expect(valueTypeName(true)).toBe("Boolean")
    expect(valueTypeName([1])).toBe("Array")
    expect(valueTypeName(new Date(0))).toBe("Date")
  })
})
