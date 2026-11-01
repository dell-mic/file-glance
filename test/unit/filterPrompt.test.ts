import { describe, expect, test } from "bun:test"

import { buildFilterMessages, formatSampleRow } from "@/ai/filterPrompt"

describe("buildFilterMessages", () => {
  test("builds system + user message with context", () => {
    const messages = buildFilterMessages(
      {
        columns: ["name (String)", "age (Number)"],
        sampleRow: '{"name":"Alice","age":"34"}',
      },
      "only adults",
    )
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe("system")
    const user = messages[1].content
    expect(user).toContain("Columns: name (String), age (Number)")
    expect(user).toContain('Sample row: {"name":"Alice","age":"34"}')
    expect(user).toContain("Instruction: only adults")
  })

  test("fix prompt includes previous code and error", () => {
    const messages = buildFilterMessages(
      { columns: [], sampleRow: "" },
      "Fix the code",
      { code: "return row[0] > 5", error: "TypeError: …" },
    )
    const user = messages[1].content
    expect(user).toContain("Current code:")
    expect(user).toContain("return row[0] > 5")
    expect(user).toContain("TypeError: …")
  })

  test("fix prompt keeps the original instruction when known", () => {
    const messages = buildFilterMessages(
      { columns: [], sampleRow: "" },
      "Fix the code",
      {
        code: "return row[0] > 5",
        error: "TypeError: …",
        instruction: "only adults",
      },
    )
    expect(messages[1].content).toContain("Original instruction: only adults")
  })
})

describe("formatSampleRow", () => {
  test("formats row as JSON object keyed by column name", () => {
    expect(formatSampleRow(["Alice", 34], ["name", "age"])).toBe(
      '{"name":"Alice","age":"34"}',
    )
  })

  test("caps columns and truncates values", () => {
    const headerRow = Array.from({ length: 50 }, (_, i) => `col${i}`)
    const row = headerRow.map(() => "x".repeat(100))
    const formatted = formatSampleRow(row, headerRow)
    const parsed = JSON.parse(formatted) as Record<string, string>
    expect(Object.keys(parsed)).toHaveLength(40)
    for (const value of Object.values(parsed)) {
      expect(value.length).toBeLessThanOrEqual(41) // 40 + ellipsis
    }
  })

  test("handles shorter rows than headers", () => {
    expect(formatSampleRow(["a"], ["name", "age"])).toBe('{"name":"a"}')
  })
})
