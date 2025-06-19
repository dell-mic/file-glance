import { expect, describe, it } from "bun:test"

import { cleanWorksheetName } from "../../src/utils"

describe("cleanWorksheetName", () => {
  it("removes forbidden Excel characters and truncates to 31 chars", () => {
    expect(cleanWorksheetName("Sheet/Name*With:Bad?Chars[]")).toBe(
      "SheetNameWithBadChars",
    )
    expect(
      cleanWorksheetName(
        "A very very very very very long worksheet name that should be truncated",
      ),
    ).toBe("A very very very very very long")
  })

  it("removes other special characters except allowed ones", () => {
    expect(cleanWorksheetName("Name!@#$%^&+=~`")).toBe("Name")
    expect(cleanWorksheetName("Name_with-dash (and parens)")).toBe(
      "Name_with-dash (and parens)",
    )
  })

  it("collapses multiple spaces and trims", () => {
    expect(cleanWorksheetName("   Name    with   spaces   ")).toBe(
      "Name with spaces",
    )
  })

  it("returns default if empty after cleaning", () => {
    expect(cleanWorksheetName("/////*****::::")).toBe("Sheet1")
    expect(cleanWorksheetName("")).toBe("Sheet1")
  })
})
