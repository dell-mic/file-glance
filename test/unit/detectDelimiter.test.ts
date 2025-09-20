import { expect, describe, it } from "bun:test"

import { detectDelimiter } from "@/utils"

describe("detectDelimiter", () => {
  it("should return comma as the delimiter if it is the most frequent", () => {
    const input = "value1,value2,value3,value4"
    expect(detectDelimiter(input)).toBe(",")
  })

  it("should return semicolon as the delimiter if it is the most frequent", () => {
    const input = "value1;value2;value3;value4"
    expect(detectDelimiter(input)).toBe(";")
  })

  it("should return pipe as the delimiter if it is the most frequent", () => {
    const input = "value1|value2|value3|value4"
    expect(detectDelimiter(input)).toBe("|")
  })

  it("should return tab as the delimiter if it is the most frequent", () => {
    const input = "val,ue1\tvalu,e2\tvalue3\tvalue4"
    expect(detectDelimiter(input)).toBe("\t")
  })

  it("should return null if there are no supported delimiters in the input", () => {
    const input = "value1 value2 value3 value4"
    expect(detectDelimiter(input)).toBeNull()
  })

  it("should return the delimiter with the highest count when multiple delimiters are present", () => {
    const input = "value1,value2|value3,value4|value5,value6"
    expect(detectDelimiter(input)).toBe(",")
  })

  it("it should detect only delimiter occurring in every row, even if not the most frequent", () => {
    const input = `v1,v2,x1;x2;x3;x4;x5;x6
    v1,v2,x1`.trim()
    expect(detectDelimiter(input)).toBe(",")
  })
  it("it should ignore effectively empty rows w/o any delimiter for detection", () => {
    const input = `"ID","Name","Age","City"
"1","Alice","25","New York"
""`.trim()
    expect(detectDelimiter(input)).toBe(",")
  })

  it("should prefer comma if two delimiters have the exact same count", () => {
    const input = "value1,value2;value3,value4;value5"

    expect(detectDelimiter(input)).toBe(",")
  })

  it("should return null for empty input", () => {
    const input = ""
    expect(detectDelimiter(input)).toBeNull()
  })
})
