import { expect, describe, it } from "bun:test"

import { cleanForFileName } from "../../src/utils"

describe("cleanForFileName", () => {
  it("removes forbidden filename characters and truncates to 255 bytes", () => {
    expect(cleanForFileName('file:name/with*bad?chars|<>"\\')).toBe(
      "filenamewithbadchars",
    )
    const longName = "a".repeat(300)
    expect(cleanForFileName(longName).length).toBeLessThanOrEqual(255)
  })

  it("removes other special characters except allowed ones", () => {
    expect(cleanForFileName("Name!@#$%^&+=~`'[]{};,")).toBe("Name")
    expect(cleanForFileName("Name_with-dash.and (parens) 2025")).toBe(
      "Name_with-dash.and (parens) 2025",
    )
  })

  it("collapses multiple spaces and trims", () => {
    expect(cleanForFileName("   Name    with   spaces   ")).toBe(
      "Name with spaces",
    )
  })

  it("returns default if empty after cleaning", () => {
    const result = cleanForFileName("/////*****::::")
    expect(result.startsWith("fileglance_export_")).toBe(true)
    expect(result.length).toBeGreaterThan(16)
    expect(cleanForFileName("")).toMatch(/^fileglance_export_\d{8}$/)
  })
})
