import { expect, describe, it } from "bun:test"

import { normalizeString } from "@/utils"

describe("normalizeString", () => {
  it("should replace uppercase letters with A", () => {
    expect(normalizeString("HELLO")).toBe("AAAAA")
  })

  it("should replace lowercase letters with a", () => {
    expect(normalizeString("hello")).toBe("aaaaa")
  })

  it("should replace numbers with 0", () => {
    expect(normalizeString("12345")).toBe("00000")
  })

  it("should handle mixed characters correctly", () => {
    expect(normalizeString("Hello123")).toBe("Aaaaa000")
  })

  it("should leave non-alphanumeric characters unchanged", () => {
    expect(normalizeString("Hello!@#")).toBe("Aaaaa!@#")
  })

  it("should return an empty string unchanged", () => {
    expect(normalizeString("")).toBe("")
  })

  it("should handle strings with only special characters", () => {
    expect(normalizeString("!@#$%^&*()")).toBe("!@#$%^&*()")
  })
})
