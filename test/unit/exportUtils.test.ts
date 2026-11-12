import { describe, expect, it } from "bun:test"
import * as XLSX from "xlsx"

import {
  buildCsv,
  buildExportMatrix,
  buildJson,
  buildXlsx,
  XLSX_MAX_CELL_LENGTH,
} from "../../src/exportUtils"

const header = ["Name", "Age", "Notes"]
const rows = [
  ["Alice", 30, "a,b"],
  ["Bob", 25, 'say "hi"'],
  ["Carol", 41, "line1\nline2"],
]

describe("buildExportMatrix", () => {
  it("drops hidden columns by default", () => {
    const matrix = buildExportMatrix(header, rows, rows, [1], {
      includeHiddenColumns: false,
      onlyFilteredRows: true,
    })
    expect(matrix[0]).toEqual(["Name", "Notes"])
    expect(matrix[1]).toEqual(["Alice", "a,b"])
  })

  it("keeps hidden columns when included", () => {
    const matrix = buildExportMatrix(header, rows, rows, [1], {
      includeHiddenColumns: true,
      onlyFilteredRows: true,
    })
    expect(matrix[0]).toEqual(header)
  })

  it("uses all rows when onlyFilteredRows is false", () => {
    const filtered = [rows[0]]
    const matrix = buildExportMatrix(header, filtered, rows, [], {
      includeHiddenColumns: false,
      onlyFilteredRows: false,
    })
    expect(matrix.length).toBe(4)
  })
})

describe("buildCsv", () => {
  it("uses comma + minimal quoting by default", () => {
    const csv = buildCsv([header, ...rows], {
      delimiter: ",",
      lineEndings: "lf",
      quoting: "minimal",
      bom: false,
      includeHeader: true,
    })
    expect(csv).toBe(
      'Name,Age,Notes\nAlice,30,"a,b"\nBob,25,"say ""hi"""\nCarol,41,"line1\nline2"\n',
    )
  })

  it("supports semicolon delimiter (German Excel)", () => {
    const csv = buildCsv([header, ...rows], {
      delimiter: ";",
      lineEndings: "lf",
      quoting: "minimal",
      bom: false,
      includeHeader: true,
    })
    expect(csv).toContain("Name;Age;Notes")
    // "a,b" needs no quoting with a semicolon delimiter
    expect(csv).toContain("Alice;30;a,b")
  })

  it("supports tab and pipe delimiters", () => {
    const base = {
      lineEndings: "lf" as const,
      quoting: "minimal" as const,
      bom: false,
      includeHeader: true,
    }
    expect(buildCsv([header], { ...base, delimiter: "\t" })).toContain(
      "Name\tAge\tNotes",
    )
    expect(buildCsv([header], { ...base, delimiter: "|" })).toContain(
      "Name|Age|Notes",
    )
  })

  it("writes CRLF line endings when requested", () => {
    const csv = buildCsv([header, ...rows], {
      delimiter: ",",
      lineEndings: "crlf",
      quoting: "minimal",
      bom: false,
      includeHeader: true,
    })
    expect(csv).toContain("Name,Age,Notes\r\n")
    expect(csv).not.toContain("Notes\nAlice")
  })

  it("quotes all fields when quoting is 'always'", () => {
    const csv = buildCsv([header], {
      delimiter: ",",
      lineEndings: "lf",
      quoting: "always",
      bom: false,
      includeHeader: true,
    })
    expect(csv).toBe('"Name","Age","Notes"\n')
  })

  it("never quotes when quoting is 'never'", () => {
    const csv = buildCsv([["A", "x,y"]], {
      delimiter: ",",
      lineEndings: "lf",
      quoting: "never",
      bom: false,
      includeHeader: true,
    })
    expect(csv).toBe("A,x,y\n")
  })

  it("prepends a BOM when requested", () => {
    const csv = buildCsv([header], {
      delimiter: ",",
      lineEndings: "lf",
      quoting: "minimal",
      bom: true,
      includeHeader: true,
    })
    expect(csv.startsWith("\uFEFF")).toBe(true)
  })

  it("can omit the header row", () => {
    const csv = buildCsv([header, ...rows], {
      delimiter: ",",
      lineEndings: "lf",
      quoting: "minimal",
      bom: false,
      includeHeader: false,
    })
    expect(csv.startsWith("Alice")).toBe(true)
  })

  it("casts booleans like the previous hardcoded export", () => {
    const csv = buildCsv([["Flag"], [true]], {
      delimiter: ",",
      lineEndings: "lf",
      quoting: "minimal",
      bom: false,
      includeHeader: true,
    })
    expect(csv).toBe("Flag\ntrue\n")
  })
})

describe("buildJson", () => {
  it("exports an array of objects keyed by the header (previous default)", () => {
    const json = buildJson([header, ...rows], {
      shape: "objects",
      indent: "tab",
      includeHeader: true,
    })
    const parsed = JSON.parse(json)
    expect(parsed).toEqual([
      { Name: "Alice", Age: 30, Notes: "a,b" },
      { Name: "Bob", Age: 25, Notes: 'say "hi"' },
      { Name: "Carol", Age: 41, Notes: "line1\nline2" },
    ])
  })

  it("exports an array of arrays, header optional", () => {
    const options = {
      shape: "arrays" as const,
      indent: "tab" as const,
      includeHeader: true,
    }
    expect(JSON.parse(buildJson([header, ...rows], options))[0]).toEqual(header)
    expect(
      JSON.parse(
        buildJson([header, ...rows], { ...options, includeHeader: false }),
      )[0],
    ).toEqual(rows[0])
  })

  it("exports NDJSON, one object per line", () => {
    const ndjson = buildJson([header, ...rows], {
      shape: "ndjson",
      indent: "none",
      includeHeader: true,
    })
    const lines = ndjson.split("\n")
    expect(lines.length).toBe(3)
    expect(JSON.parse(lines[0])).toEqual({
      Name: "Alice",
      Age: 30,
      Notes: "a,b",
    })
    expect(lines[1].startsWith("{")).toBe(true)
  })

  it("supports minified output", () => {
    const json = buildJson([header, ...rows], {
      shape: "objects",
      indent: "none",
      includeHeader: true,
    })
    expect(json).not.toContain("\n")
    expect(json).not.toContain("\t")
  })
})

describe("buildXlsx", () => {
  const readBack = (bytes: Uint8Array) =>
    XLSX.read(bytes, { type: "array" }).Sheets.Sheet1!

  it("keeps native cell types by default", () => {
    const ws = readBack(
      buildXlsx([header, ...rows], {
        cellType: "native",
        sheetName: "Sheet1",
        autofilter: false,
        includeHeader: true,
      }),
    )
    expect(ws["B2"].t).toBe("n")
    expect(ws["B2"].v).toBe(30)
    expect(ws["A2"].t).toBe("s")
  })

  it("stringifies all cells in text mode", () => {
    const ws = readBack(
      buildXlsx([header, ...rows], {
        cellType: "text",
        sheetName: "Sheet1",
        autofilter: false,
        includeHeader: true,
      }),
    )
    expect(ws["B2"].t).toBe("s")
    expect(ws["B2"].v).toBe("30")
  })

  it("adds an autofilter over the full range when enabled", () => {
    const ws = readBack(
      buildXlsx([header, ...rows], {
        cellType: "native",
        sheetName: "Sheet1",
        autofilter: true,
        includeHeader: true,
      }),
    )
    expect(ws["!autofilter"]).toEqual({ ref: "A1:C4" })
  })

  it("omits the autofilter when disabled", () => {
    const ws = readBack(
      buildXlsx([header, ...rows], {
        cellType: "native",
        sheetName: "Sheet1",
        autofilter: false,
        includeHeader: true,
      }),
    )
    expect(ws["!autofilter"]).toBeUndefined()
  })

  it("can omit the header row", () => {
    const ws = readBack(
      buildXlsx([header, ...rows], {
        cellType: "native",
        sheetName: "Sheet1",
        autofilter: false,
        includeHeader: false,
      }),
    )
    expect(ws["A1"].v).toBe("Alice")
  })

  it("truncates cells beyond Excel's 32,767 character limit", () => {
    const long = "x".repeat(XLSX_MAX_CELL_LENGTH + 100)
    const ws = readBack(
      buildXlsx([["Notes"], [long]], {
        cellType: "native",
        sheetName: "Sheet1",
        autofilter: false,
        includeHeader: true,
      }),
    )
    expect((ws["A2"].v as string).length).toBe(XLSX_MAX_CELL_LENGTH)
  })

  it("uses the requested sheet name", () => {
    const workbook = XLSX.read(
      buildXlsx([header, ...rows], {
        cellType: "native",
        sheetName: "My Data",
        autofilter: false,
        includeHeader: true,
      }),
      { type: "array" },
    )
    expect(workbook.SheetNames).toContain("My Data")
  })
})
