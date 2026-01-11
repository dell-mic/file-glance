import { expect, describe, it } from "bun:test"

import { normalizeString } from "@/utils"

describe("normalizeString", () => {
  it("should replace consecutive uppercase letters with single A", () => {
    expect(normalizeString("HELLO")).toBe("A")
  })

  it("should replace consecutive lowercase letters with single a", () => {
    expect(normalizeString("hello")).toBe("a")
  })

  it("should replace consecutive numbers with single 0", () => {
    expect(normalizeString("12345")).toBe("0")
  })

  it("should handle mixed characters correctly", () => {
    expect(normalizeString("Hello123")).toBe("Aa0")
  })

  it("should leave non-alphanumeric characters unchanged", () => {
    expect(normalizeString("Hello!@#")).toBe("Aa!@#")
  })

  it("should return an empty string unchanged", () => {
    expect(normalizeString("")).toBe("")
  })

  it("should handle strings with only special characters", () => {
    expect(normalizeString("!@#$%^&*()")).toBe("!@#$%^&*()")
  })

  it("should handle alternating character types", () => {
    expect(normalizeString("AaBb11")).toBe("AaAa0")
  })
})
