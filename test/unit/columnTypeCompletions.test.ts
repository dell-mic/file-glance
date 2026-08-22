import { describe, expect, it } from "bun:test"

import { buildRowTypeLib, tsTypeForColumnType } from "@/utils"
import type { ColumnInfos } from "@/app/components/ValueInspector"

function columnInfo(
  columnIndex: number,
  columnName: string,
  columnType: string,
): ColumnInfos {
  return {
    columnIndex,
    columnName,
    columnType: columnType as ColumnInfos["columnType"],
    columnValues: [],
    valuesMaxLength: 0,
    isEmptyColumn: true,
  }
}

describe("tsTypeForColumnType", () => {
  it("maps constructor names to TS types", () => {
    expect(tsTypeForColumnType("String")).toBe("string")
    expect(tsTypeForColumnType("Number")).toBe("number")
    expect(tsTypeForColumnType("Boolean")).toBe("boolean")
    expect(tsTypeForColumnType("BigInt")).toBe("bigint")
    expect(tsTypeForColumnType("Date")).toBe("Date")
    expect(tsTypeForColumnType("Array")).toBe("any[]")
  })

  it("falls back to any for unknown or mixed columns", () => {
    expect(tsTypeForColumnType("any")).toBe("any")
    expect(tsTypeForColumnType("SomethingElse")).toBe("any")
  })
})

describe("buildRowTypeLib", () => {
  it("falls back to plain any without headers", () => {
    const lib = buildRowTypeLib("ts:fileglance/test.d.ts", [])
    expect(lib.uri).toBe("ts:fileglance/test.d.ts")
    expect(lib.content).toBe("declare var row: any\n")
  })

  it("declares typed members, quoting all keys", () => {
    const lib = buildRowTypeLib(
      "ts:fileglance/test.d.ts",
      ["ID", "Phone Number"],
      [columnInfo(0, "ID", "String"), columnInfo(1, "Phone Number", "String")],
    )
    expect(lib.content).toBe(
      `declare var row: any[] & {\n  "ID": string\n  "Phone Number": string\n}\n`,
    )
  })

  it("skips empty headers and duplicates (first occurrence wins)", () => {
    const lib = buildRowTypeLib(
      "ts:fileglance/test.d.ts",
      ["a", "", "b", "a"],
      [
        columnInfo(0, "a", "Number"),
        columnInfo(2, "b", "String"),
        columnInfo(3, "a", "String"),
      ],
    )
    expect(lib.content).toBe(
      `declare var row: any[] & {\n  "a": number\n  "b": string\n}\n`,
    )
  })

  it("escapes quotes in header names", () => {
    const lib = buildRowTypeLib("ts:fileglance/test.d.ts", ['say "hi"'])
    expect(lib.content).toContain(`"say \\"hi\\"":`)
  })

  it("types unknown columns as any when no infos are given", () => {
    const lib = buildRowTypeLib("ts:fileglance/test.d.ts", ["a", "b"])
    expect(lib.content).toContain('"a": any')
    expect(lib.content).toContain('"b": any')
  })
})
