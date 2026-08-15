import { expect, describe, it } from "bun:test"

import { CSVParseError, parseCSV } from "@/csvUtils"

describe("parseCSV - basic parsing", () => {
  it("parses simple CSV with explicit delimiter", () => {
    const result = parseCSV("a,b\n1,2", { delimiter: "," })
    expect(result.records).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
    expect(result.format).toBe("csv")
    expect(result.delimiter).toBe(",")
    expect(result.headerRow).toBeUndefined()
  })

  it("parses input without trailing newline", () => {
    expect(parseCSV("a,b\n1,2", { delimiter: "," }).records).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("ignores a single trailing newline", () => {
    expect(parseCSV("a,b\n1,2\n", { delimiter: "," }).records).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("handles CRLF line endings", () => {
    expect(parseCSV("a,b\r\n1,2\r\n", { delimiter: "," }).records).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("handles CR-only line endings", () => {
    expect(parseCSV("a,b\r1,2\r", { delimiter: "," }).records).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("locks onto the first record delimiter encountered", () => {
    // After CRLF the lone LF is a literal field character
    expect(() => parseCSV("a,b\r\n1,2\n3,4", { delimiter: "," })).toThrowError(
      CSVParseError,
    )
    expect(
      parseCSV("a,b\r\n1,2\n3,4", {
        delimiter: ",",
        relax_column_count: true,
      }).records,
    ).toEqual([
      ["a", "b"],
      ["1", "2\n3", "4"],
    ])
  })

  it("returns empty records for empty input", () => {
    expect(parseCSV("", { delimiter: "," }).records).toEqual([])
  })

  it("parses input consisting of a single newline as one empty record", () => {
    expect(parseCSV("\n", { delimiter: "," }).records).toEqual([[""]])
  })

  it("parses a lone delimiter as two empty fields", () => {
    expect(parseCSV(",", { delimiter: "," }).records).toEqual([["", ""]])
  })

  it("parses a single field without delimiter", () => {
    expect(parseCSV("hello", { delimiter: "," }).records).toEqual([["hello"]])
  })

  it("preserves whitespace (no trimming)", () => {
    expect(parseCSV(" a , b \n 1 , 2 ", { delimiter: "," }).records).toEqual([
      [" a ", " b "],
      [" 1 ", " 2 "],
    ])
  })

  it("treats single quotes as literal characters", () => {
    expect(parseCSV("'a','b'", { delimiter: "," }).records).toEqual([
      ["'a'", "'b'"],
    ])
  })

  it("supports tab delimiter", () => {
    expect(parseCSV("a\tb\n1\t2", { delimiter: "\t" }).records).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("supports multi-character delimiters", () => {
    expect(parseCSV("a||b\n1||2", { delimiter: "||" }).records).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
    // single "|" is not a delimiter anymore
    expect(parseCSV("a|b\n1|2", { delimiter: "||" }).records).toEqual([
      ["a|b"],
      ["1|2"],
    ])
  })

  it("supports delimiter at end of input", () => {
    expect(parseCSV("a,", { delimiter: "," }).records).toEqual([["a", ""]])
  })

  it("handles unicode and emoji content", () => {
    expect(parseCSV("é,ü\n✓,😀", { delimiter: "," }).records).toEqual([
      ["é", "ü"],
      ["✓", "😀"],
    ])
  })

  it("throws on empty delimiter option", () => {
    expect(() => parseCSV("a,b", { delimiter: "" })).toThrowError(CSVParseError)
  })
})

describe("parseCSV - quoting", () => {
  it("parses quoted fields containing the delimiter", () => {
    expect(parseCSV('a,b\n"1,5",2', { delimiter: "," }).records).toEqual([
      ["a", "b"],
      ["1,5", "2"],
    ])
  })

  it("parses quoted fields containing newlines", () => {
    expect(parseCSV('a,b\n"x\ny",2', { delimiter: "," }).records).toEqual([
      ["a", "b"],
      ["x\ny", "2"],
    ])
  })

  it("parses quoted fields containing CRLF", () => {
    expect(parseCSV('a,b\r\n"x\r\ny",2', { delimiter: "," }).records).toEqual([
      ["a", "b"],
      ["x\r\ny", "2"],
    ])
  })

  it("parses escaped (doubled) quotes", () => {
    expect(parseCSV('a,b\n"x""y",2', { delimiter: "," }).records).toEqual([
      ["a", "b"],
      ['x"y', "2"],
    ])
  })

  it("parses escaped quote at end of quoted field", () => {
    expect(parseCSV('a,b\n"x""",2', { delimiter: "," }).records).toEqual([
      ["a", "b"],
      ['x"', "2"],
    ])
  })

  it("parses quoted empty string", () => {
    expect(parseCSV('a,b\n"",2', { delimiter: "," }).records).toEqual([
      ["a", "b"],
      ["", "2"],
    ])
  })

  it("parses input that is a single quoted empty field", () => {
    expect(parseCSV('""', { delimiter: "," }).records).toEqual([[""]])
  })

  it("parses a quoted field at end of input without newline", () => {
    expect(parseCSV('"a"', { delimiter: "," }).records).toEqual([["a"]])
  })

  it("throws on unclosed quote", () => {
    expect(() => parseCSV('a,b\n"xy,2', { delimiter: "," })).toThrowError(
      expect.objectContaining({ code: "CSV_QUOTE_NOT_CLOSED" }),
    )
  })

  it("throws on invalid closing quote", () => {
    expect(() => parseCSV('a,b\n"x"y,2', { delimiter: "," })).toThrowError(
      expect.objectContaining({ code: "CSV_INVALID_CLOSING_QUOTE" }),
    )
  })

  it("throws on quote inside an unquoted field", () => {
    expect(() => parseCSV('a,b\n1,fo"o"bar', { delimiter: "," })).toThrowError(
      expect.objectContaining({ code: "INVALID_OPENING_QUOTE" }),
    )
  })

  it("throws on quoted field followed by a space", () => {
    expect(() => parseCSV('"a" "b"', { delimiter: "," })).toThrowError(
      expect.objectContaining({ code: "CSV_INVALID_CLOSING_QUOTE" }),
    )
  })
})

describe("parseCSV - relax_quotes", () => {
  it("treats quotes inside unquoted fields as literal", () => {
    expect(
      parseCSV('a,b\n1,fo"o"bar', { delimiter: ",", relax_quotes: true })
        .records,
    ).toEqual([
      ["a", "b"],
      ["1", 'fo"o"bar'],
    ])
  })

  it("treats the whole field as raw when a closing quote is followed by text", () => {
    expect(
      parseCSV('a,b\n"x"y,2', { delimiter: ",", relax_quotes: true }).records,
    ).toEqual([
      ["a", "b"],
      ['"x"y', "2"],
    ])
  })

  it("treats the whole field as raw when a closing quote is followed by a space", () => {
    expect(
      parseCSV('a,b\n"x" ,2', { delimiter: ",", relax_quotes: true }).records,
    ).toEqual([
      ["a", "b"],
      ['"x" ', "2"],
    ])
  })

  it("still parses regular quoted fields", () => {
    expect(
      parseCSV('a,b\n"x,y""z",2', { delimiter: ",", relax_quotes: true })
        .records,
    ).toEqual([
      ["a", "b"],
      ['x,y"z', "2"],
    ])
  })

  it("still throws on unclosed quotes", () => {
    expect(() =>
      parseCSV('a,b\n"xy,2', { delimiter: ",", relax_quotes: true }),
    ).toThrowError(expect.objectContaining({ code: "CSV_QUOTE_NOT_CLOSED" }))
  })
})

describe("parseCSV - relax_column_count", () => {
  it("throws on inconsistent column count by default", () => {
    expect(() => parseCSV("a,b\n1,2,3", { delimiter: "," })).toThrowError(
      expect.objectContaining({
        code: "CSV_RECORD_INCONSISTENT_FIELDS_LENGTH",
      }),
    )
  })

  it("allows more columns when relaxed", () => {
    expect(
      parseCSV("a,b\n1,2,3", { delimiter: ",", relax_column_count: true })
        .records,
    ).toEqual([
      ["a", "b"],
      ["1", "2", "3"],
    ])
  })

  it("allows fewer columns when relaxed", () => {
    expect(
      parseCSV("a,b,c\n1,2", { delimiter: ",", relax_column_count: true })
        .records,
    ).toEqual([
      ["a", "b", "c"],
      ["1", "2"],
    ])
  })

  it("takes the first record as the expected length", () => {
    expect(() => parseCSV("a,b,c\n1,2", { delimiter: "," })).toThrowError(
      expect.objectContaining({
        code: "CSV_RECORD_INCONSISTENT_FIELDS_LENGTH",
      }),
    )
  })
})

describe("parseCSV - skip_empty_lines", () => {
  it("skips empty lines", () => {
    expect(
      parseCSV("a,b\n\n\n1,2\n", { delimiter: ",", skip_empty_lines: true })
        .records,
    ).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("skips empty lines with CRLF endings", () => {
    expect(
      parseCSV("a,b\r\n\r\n1,2", { delimiter: ",", skip_empty_lines: true })
        .records,
    ).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("does not skip whitespace-only lines", () => {
    expect(
      parseCSV("a,b\n \n1,2", {
        delimiter: ",",
        skip_empty_lines: true,
        relax_column_count: true,
      }).records,
    ).toEqual([["a", "b"], [" "], ["1", "2"]])
  })

  it("does not skip lines with a quoted empty field", () => {
    expect(
      parseCSV('a,b\n""\n1,2', {
        delimiter: ",",
        skip_empty_lines: true,
        relax_column_count: true,
      }).records,
    ).toEqual([["a", "b"], [""], ["1", "2"]])
  })

  it("produces empty records for empty lines when not skipped", () => {
    expect(
      parseCSV("\n\n", { delimiter: ",", relax_column_count: true }).records,
    ).toEqual([[""], [""]])
  })
})

describe("parseCSV - bom", () => {
  it("strips a leading BOM when bom is true", () => {
    expect(
      parseCSV("﻿a,b\n1,2", { delimiter: ",", bom: true }).records,
    ).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("keeps the BOM when bom is false", () => {
    const result = parseCSV("﻿a,b\n1,2", { delimiter: "," })
    expect(result.records[0][0]).toBe("﻿a")
  })

  it("handles input that is only a BOM", () => {
    expect(parseCSV("﻿", { delimiter: ",", bom: true }).records).toEqual([])
  })
})

describe("parseCSV - auto delimiter", () => {
  it("detects comma", () => {
    const result = parseCSV("a,b,c\n1,2,3")
    expect(result.format).toBe("csv")
    expect(result.delimiter).toBe(",")
    expect(result.records).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ])
  })

  it("detects semicolon", () => {
    expect(parseCSV("a;b;c\n1;2;3").delimiter).toBe(";")
  })

  it("detects tab", () => {
    expect(parseCSV("a\tb\tc\n1\t2\t3").delimiter).toBe("\t")
  })

  it("detects pipe", () => {
    expect(parseCSV("a|b|c\n1|2|3").delimiter).toBe("|")
  })

  it("detects tilde and hash", () => {
    expect(parseCSV("a~b~c\n1~2~3").delimiter).toBe("~")
    expect(parseCSV("a#b#c\n1#2#3").delimiter).toBe("#")
  })

  it("returns null delimiter and empty records when nothing is detected", () => {
    const result = parseCSV("hello world\nfoo bar")
    expect(result.format).toBe("csv")
    expect(result.delimiter).toBeNull()
    expect(result.records).toEqual([])
  })

  it("returns null delimiter for empty input", () => {
    const result = parseCSV("")
    expect(result.delimiter).toBeNull()
    expect(result.records).toEqual([])
  })

  it("applies parse options in auto mode", () => {
    const result = parseCSV('a,b\n\n"x"y,2', {
      delimiter: "auto",
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    })
    expect(result.records).toEqual([
      ["a", "b"],
      ['"x"y', "2"],
    ])
  })

  it("auto is the default delimiter mode", () => {
    expect(parseCSV("a,b\n1,2").delimiter).toBe(",")
  })
})

describe("parseCSV - line separated JSON", () => {
  it("detects and parses line-separated JSON in auto mode", () => {
    const result = parseCSV('{"a":1,"b":"x"}\n{"a":2,"b":"y"}')
    expect(result.format).toBe("lsjson")
    expect(result.delimiter).toBeNull()
    expect(result.headerRow).toEqual(["a", "b"])
    expect(result.records).toEqual([
      [1, "x"],
      [2, "y"],
    ])
  })

  it("flattens nested objects", () => {
    const result = parseCSV('{"user":{"name":"Alice"},"status":"ok"}')
    expect(result.format).toBe("lsjson")
    expect(result.headerRow).toEqual(["user.name", "status"])
    expect(result.records).toEqual([["Alice", "ok"]])
  })

  it("keeps arrays as values", () => {
    const result = parseCSV('{"a":[1,2,3]}')
    expect(result.format).toBe("lsjson")
    expect(result.records).toEqual([[[1, 2, 3]]])
  })

  it("builds the header as union of keys in first-appearance order", () => {
    const result = parseCSV('{"a":1}\n{"b":2,"a":3}')
    expect(result.headerRow).toEqual(["a", "b"])
    expect(result.records).toEqual([
      [1, undefined],
      [3, 2],
    ])
  })

  it("skips blank lines and non-JSON lines after the first valid one", () => {
    const result = parseCSV('{"a":1}\n\nnot json\n{"a":2}\n')
    expect(result.format).toBe("lsjson")
    expect(result.records).toEqual([[1], [2]])
  })

  it("falls back to CSV when the first line is not JSON", () => {
    const result = parseCSV("a,b\n1,2")
    expect(result.format).toBe("csv")
    expect(result.delimiter).toBe(",")
  })

  it("does not detect lsjson with an explicit delimiter", () => {
    // quotes right after "{" are invalid opening quotes in CSV mode,
    // same as csv-parse behaves on this input
    expect(() => parseCSV('{"a":1}\n{"a":2}', { delimiter: "," })).toThrowError(
      expect.objectContaining({ code: "INVALID_OPENING_QUOTE" }),
    )
    // ... and lsjson stays undetected even when it parses cleanly as CSV
    const relaxed = parseCSV('{"a":1}\n{"a":2}', {
      delimiter: ",",
      relax_quotes: true,
    })
    expect(relaxed.format).toBe("csv")
    expect(relaxed.records).toEqual([['{"a":1}'], ['{"a":2}']])
  })

  it("handles a single JSON object", () => {
    const result = parseCSV('{"name":"Alice","age":30}')
    expect(result.format).toBe("lsjson")
    expect(result.headerRow).toEqual(["name", "age"])
    expect(result.records).toEqual([["Alice", 30]])
  })

  it("handles BOM before lsjson content", () => {
    const result = parseCSV('﻿{"a":1}', { bom: true })
    expect(result.format).toBe("lsjson")
    expect(result.records).toEqual([[1]])
  })
})
