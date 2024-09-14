import { isMarkdownTable, parseMarkdownTable } from "@/markdownUtils"
import { expect, describe, it } from "bun:test"

describe("parseMarkdownTable", () => {
  it("should parse a basic markdown table with left and right bounds", () => {
    const input = `
      | Header 1 | Header 2 |
      | -------- | -------- |
      | Row 1    | Data 1   |
      | Row 2    | Data 2   |
    `

    const result = parseMarkdownTable(input)

    expect(result.headerRow).toEqual(["Header 1", "Header 2"])
    expect(result.rows).toEqual([
      ["Row 1", "Data 1"],
      ["Row 2", "Data 2"],
    ])
  })

  it("should handle missing left and right bounds in headers", () => {
    const input = `
      Header 1 | Header 2
      -------- | --------
      Row 1    | Data 1
      Row 2    | Data 2
    `

    const result = parseMarkdownTable(input)

    expect(result.headerRow).toEqual(["Header 1", "Header 2"])
    expect(result.rows).toEqual([
      ["Row 1", "Data 1"],
      ["Row 2", "Data 2"],
    ])
  })

  it("should handle extra spaces around headers and rows", () => {
    const input = `
        |   Header 1   |  Header 2   |
        | ------------ | ----------- |
        |   Row 1      |  Data 1     |
        |   Row 2      |  Data 2     |
    `

    const result = parseMarkdownTable(input)

    expect(result.headerRow).toEqual(["Header 1", "Header 2"])
    expect(result.rows).toEqual([
      ["Row 1", "Data 1"],
      ["Row 2", "Data 2"],
    ])
  })

  it("should throw SyntaxError for empty input text", () => {
    const input = ``

    expect(() => parseMarkdownTable(input)).toThrow(SyntaxError)
    expect(() => parseMarkdownTable(input)).toThrow("Text is empty")
  })

  it("should throw SyntaxError if only whitespace is provided", () => {
    const input = `      `

    expect(() => parseMarkdownTable(input)).toThrow(SyntaxError)
    expect(() => parseMarkdownTable(input)).toThrow("Text is empty")
  })

  it("should throw SyntaxError if no | in header row", () => {
    const input = `   
    some,commma,separated
    value,value2,value4
    `

    expect(() => parseMarkdownTable(input)).toThrow(SyntaxError)
    expect(() => parseMarkdownTable(input)).toThrow("Text is empty")
  })

  it("should ignore empty lines at the start and end", () => {
    const input = `
    
      | Header 1 | Header 2 |
      | -------- | -------- |
      | Row 1    | Data 1   |
      | Row 2    | Data 2   |
    
    `

    const result = parseMarkdownTable(input)

    expect(result.headerRow).toEqual(["Header 1", "Header 2"])
    expect(result.rows).toEqual([
      ["Row 1", "Data 1"],
      ["Row 2", "Data 2"],
    ])
  })
})

describe("isMarkdownTable", () => {
  it("should return true for a valid markdown table with left and right bounds", () => {
    const input = `
      | Header 1 | Header 2 |
      | -------- | -------- |
      | Row 1    | Data 1   |
      | Row 2    | Data 2   |
    `
    expect(isMarkdownTable(input)).toBe(true)
  })

  it("should return false for a technical valid markdown table, but without left and right bounds", () => {
    const input = `
      Header 1 | Header 2
      -------- | --------
      Row 1    | Data 1
      Row 2    | Data 2
    `
    expect(isMarkdownTable(input)).toBe(false)
  })

  it("should return true for a table with extra spaces around headers and rows", () => {
    const input = `
        |   Header 1   |  Header 2   |
        | ------------ | ----------- |
        |   Row 1      |  Data 1     |
        |   Row 2      |  Data 2     |
    `
    expect(isMarkdownTable(input)).toBe(true)
  })

  it("should return false for an input without proper separators", () => {
    const input = `
      Header 1 | Header 2
      Row 1    | Data 1
      Row 2    | Data 2
    `
    expect(isMarkdownTable(input)).toBe(false) // Missing hyphen separator
  })

  it("should return false for an input without any headers", () => {
    const input = `
      Row 1    | Data 1
      Row 2    | Data 2
    `
    expect(isMarkdownTable(input)).toBe(false)
  })

  it("should return false for non-table content", () => {
    const input = `
      This is just some text.
      It does not resemble a markdown table.
    `
    expect(isMarkdownTable(input)).toBe(false)
  })

  it("should return false for an empty string", () => {
    const input = ``
    expect(isMarkdownTable(input)).toBe(false)
  })

  it("should return false for a string containing only spaces or newlines", () => {
    const input = `
      
      
      
    `
    expect(isMarkdownTable(input)).toBe(false)
  })

  it("should return true for a table with mixed column alignments", () => {
    const input = `
      | Header 1 | Header 2 | Header 3 |
      |:-------- |:--------:| --------:|
      | Row 1    | Data 1   |   Data 2 |
    `
    expect(isMarkdownTable(input)).toBe(true)
  })

  it("should return true for a single-row markdown table", () => {
    const input = `
      | Header 1 | Header 2 |
      | -------- | -------- |
    `
    expect(isMarkdownTable(input)).toBe(true)
  })
})
