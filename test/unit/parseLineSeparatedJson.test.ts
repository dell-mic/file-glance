import { expect, describe, it } from "bun:test"

import { parseLineSeparatedJson } from "@/utils"

describe("parseLineSeparatedJson", () => {
  it("should parse line-separated JSON objects into a table format", () => {
    const input = `{"timestamp":"2026-01-27T10:15:01Z","method":"GET","path":"/","status":200}
{"timestamp":"2026-01-27T10:15:02Z","method":"GET","path":"/favicon.ico","status":404,"response_time_ms":3}`

    const result = parseLineSeparatedJson(input)

    expect(result).not.toBeNull()
    expect(result!.headerRow).toEqual([
      "timestamp",
      "method",
      "path",
      "status",
      "response_time_ms",
    ])
    expect(result!.data.length).toBe(2)
    expect(result!.data[0]).toEqual([
      "2026-01-27T10:15:01Z",
      "GET",
      "/",
      200,
      undefined,
    ])
    expect(result!.data[1]).toEqual([
      "2026-01-27T10:15:02Z",
      "GET",
      "/favicon.ico",
      404,
      3,
    ])
  })

  it("should include all keys from all lines in header row, even if not in first line", () => {
    const input = `{"a":1,"b":2}
{"a":10,"b":20,"c":30}
{"a":100,"d":40}`

    const result = parseLineSeparatedJson(input)

    expect(result).not.toBeNull()
    expect(result!.headerRow).toEqual(["a", "b", "c", "d"])
    expect(result!.data.length).toBe(3)
    expect(result!.data[0]).toEqual([1, 2, undefined, undefined])
    expect(result!.data[1]).toEqual([10, 20, 30, undefined])
    expect(result!.data[2]).toEqual([100, undefined, undefined, 40])
  })

  it("should preserve header order based on first appearance", () => {
    const input = `{"z":1,"a":2,"m":3}
{"a":10,"z":20,"m":30,"b":40}`

    const result = parseLineSeparatedJson(input)

    expect(result).not.toBeNull()
    expect(result!.headerRow).toEqual(["z", "a", "m", "b"])
  })

  it("should ignore empty lines", () => {
    const input = `{"a":1,"b":2}

{"a":10,"b":20}

`

    const result = parseLineSeparatedJson(input)

    expect(result).not.toBeNull()
    expect(result!.data.length).toBe(2)
    expect(result!.data[0]).toEqual([1, 2])
    expect(result!.data[1]).toEqual([10, 20])
  })

  it("should ignore non-JSON lines after the first valid line", () => {
    const input = `{"a":1,"b":2}
this is not json
{"a":10,"b":20}
also not json
{"a":100,"b":200}`

    const result = parseLineSeparatedJson(input)

    expect(result).not.toBeNull()
    expect(result!.data.length).toBe(3)
    expect(result!.data[0]).toEqual([1, 2])
    expect(result!.data[1]).toEqual([10, 20])
    expect(result!.data[2]).toEqual([100, 200])
  })

  it("should return null if the first non-empty line is not valid JSON", () => {
    const input = `this is not json
{"a":1,"b":2}
{"a":10,"b":20}`

    const result = parseLineSeparatedJson(input)

    expect(result).toBeNull()
  })

  it("should return null if input starts with invalid JSON before any empty lines", () => {
    const input = `invalid json
{"a":1}`

    expect(parseLineSeparatedJson(input)).toBeNull()
  })

  it("should handle mixed property types correctly", () => {
    const input = `{"id":1,"name":"Alice","active":true,"score":92.5}
{"id":2,"name":"Bob","active":false,"score":87.3}`

    const result = parseLineSeparatedJson(input)

    expect(result).not.toBeNull()
    expect(result!.data[0]).toEqual([1, "Alice", true, 92.5])
    expect(result!.data[1]).toEqual([2, "Bob", false, 87.3])
  })

  it("should handle nested objects by flattening them", () => {
    const input = `{"user":{"name":"Alice","age":30},"status":"active"}`

    const result = parseLineSeparatedJson(input)

    expect(result).not.toBeNull()
    expect(result!.headerRow).toContain("user.name")
    expect(result!.headerRow).toContain("user.age")
    expect(result!.headerRow).toContain("status")
  })

  it("should handle null and undefined values", () => {
    const input = `{"a":1,"b":null,"c":"value"}
{"a":2,"b":"text","c":null}`

    const result = parseLineSeparatedJson(input)

    expect(result).not.toBeNull()
    expect(result!.data.length).toBe(2)
    expect(result!.data[0][1]).toBe(null)
    expect(result!.data[1][2]).toBe(null)
  })

  it("should return null for input with only empty lines and invalid JSON", () => {
    const input = `

invalid json`

    expect(parseLineSeparatedJson(input)).toBeNull()
  })

  it("should return null for completely empty input", () => {
    const input = ""

    expect(parseLineSeparatedJson(input)).toBeNull()
  })

  it("should handle single JSON object", () => {
    const input = `{"name":"Alice","age":30,"city":"NYC"}`

    const result = parseLineSeparatedJson(input)

    expect(result).not.toBeNull()
    expect(result!.headerRow).toEqual(["name", "age", "city"])
    expect(result!.data.length).toBe(1)
    expect(result!.data[0]).toEqual(["Alice", 30, "NYC"])
  })
})
