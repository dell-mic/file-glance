import { describe, expect, it } from "bun:test"

import {
  SearchOptions,
  applyFilters,
  createSearchMatcher,
  defaultSearchOptions,
} from "@/utils"

const header = ["name", "city", "salary"]
const rows: any[][] = [
  ["Alice", "Berlin", 1000],
  ["bob", "Canada", 2000],
  ["Carol", "berlin", 3000],
]

const insensitive: SearchOptions = { caseSensitive: false, regex: false }
const sensitive: SearchOptions = { caseSensitive: true, regex: false }
const regexInsensitive: SearchOptions = { caseSensitive: false, regex: true }
const regexSensitive: SearchOptions = { caseSensitive: true, regex: true }

describe("createSearchMatcher", () => {
  it("matches case-insensitively by default options", () => {
    const matcher = createSearchMatcher("BERLIN", insensitive)
    expect(matcher.error).toBeUndefined()
    expect(matcher.matches("Berlin")).toBe(true)
    expect(matcher.matches("berlin")).toBe(true)
    expect(matcher.matches("London")).toBe(false)
  })

  it("respects case sensitivity when enabled", () => {
    const matcher = createSearchMatcher("Berlin", sensitive)
    expect(matcher.matches("Berlin")).toBe(true)
    expect(matcher.matches("berlin")).toBe(false)
  })

  it("matches formatted numbers via valueAsStringFormatted", () => {
    // 1000 formats to "1,000" for lengths > 4? No: "1000".length === 4, so raw.
    const matcher = createSearchMatcher("1,000", insensitive)
    expect(matcher.matches(1000000)).toBe(true) // "1,000,000"
    expect(matcher.matches(999)).toBe(false)
  })

  it("supports regex mode", () => {
    const matcher = createSearchMatcher("^Be.*n$", regexSensitive)
    expect(matcher.matches("Berlin")).toBe(true)
    expect(matcher.matches("Aberlinx")).toBe(false)
  })

  it("applies case-insensitivity to regex mode", () => {
    const matcher = createSearchMatcher("^be", regexInsensitive)
    expect(matcher.matches("Berlin")).toBe(true)
    expect(matcher.matches("ember")).toBe(false)
  })

  it("treats regex metacharacters as patterns, not literals", () => {
    const matcher = createSearchMatcher("a.c", regexSensitive)
    expect(matcher.matches("abc")).toBe(true)
    const literal = createSearchMatcher("a.c", sensitive)
    expect(literal.matches("abc")).toBe(false)
    expect(literal.matches("a.c")).toBe(true)
  })

  it("reports an error for invalid regex without throwing", () => {
    const matcher = createSearchMatcher("[unclosed", regexSensitive)
    expect(matcher.error).toBeTruthy()
    expect(matcher.matches("anything")).toBe(false)
  })

  it("never reports an error in substring mode", () => {
    expect(createSearchMatcher("[unclosed(", sensitive).error).toBeUndefined()
  })
})

describe("applyFilters search integration", () => {
  it("filters case-insensitively by default across all columns", () => {
    const result = applyFilters(
      rows,
      header,
      [],
      "BERLIN",
      defaultSearchOptions,
      null,
      null,
    )
    expect(result.length).toBe(2)
  })

  it("filters case-sensitively when configured", () => {
    const result = applyFilters(
      rows,
      header,
      [],
      "berlin",
      sensitive,
      null,
      null,
    )
    expect(result.length).toBe(1)
    expect(result[0][0]).toBe("Carol")
  })

  it("filters with regex when configured", () => {
    const result = applyFilters(
      rows,
      header,
      [],
      "^B",
      regexSensitive,
      null,
      null,
    )
    // Only "Berlin" (Alice) and "bob"? No: "bob" is lowercase, so just Alice
    expect(result.length).toBe(1)
    expect(result[0][0]).toBe("Alice")
  })

  it("scopes regex search to a column via columnName:term", () => {
    const result = applyFilters(
      rows,
      header,
      [],
      "city:^Canada$",
      regexSensitive,
      null,
      null,
    )
    expect(result.length).toBe(1)
    expect(result[0][0]).toBe("bob")
  })

  it("ignores the search entirely on invalid regex", () => {
    const result = applyFilters(
      rows,
      header,
      [],
      "[unclosed",
      regexSensitive,
      null,
      null,
    )
    expect(result.length).toBe(3)
  })

  it("ignores the search entirely on invalid regex in column scope", () => {
    const result = applyFilters(
      rows,
      header,
      [],
      "city:[unclosed",
      regexSensitive,
      null,
      null,
    )
    expect(result.length).toBe(3)
  })

  it("returns all rows when search is empty regardless of options", () => {
    const result = applyFilters(
      rows,
      header,
      [],
      "",
      regexSensitive,
      null,
      null,
    )
    expect(result.length).toBe(3)
  })
})
