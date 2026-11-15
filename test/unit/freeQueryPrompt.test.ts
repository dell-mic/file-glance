import { describe, expect, test } from "bun:test"

import { buildFreeQueryMessages } from "@/ai/freeQueryPrompt"

describe("buildFreeQueryMessages", () => {
  test("builds system + user message with context", () => {
    const messages = buildFreeQueryMessages(
      {
        columns: ["name (String)", "age (Number)"],
        sampleRow: '{"name":"Alice","age":34}',
      },
      "names of adults",
    )
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe("system")
    const user = messages[1].content
    expect(user).toContain("Columns: name (String), age (Number)")
    expect(user).toContain('Sample row: {"name":"Alice","age":34}')
    expect(user).toContain("Instruction: names of adults")
  })

  test("fix prompt includes previous code and error", () => {
    const messages = buildFreeQueryMessages(
      { columns: [], sampleRow: "" },
      "Fix the code",
      { code: "return data.map(r => r[0])", error: "TypeError: …" },
    )
    const user = messages[1].content
    expect(user).toContain("Current code:")
    expect(user).toContain("return data.map(r => r[0])")
    expect(user).toContain("TypeError: …")
  })

  test("fix prompt keeps the original instruction when known", () => {
    const messages = buildFreeQueryMessages(
      { columns: [], sampleRow: "" },
      "Fix the code",
      {
        code: "return data.map(r => r[0])",
        error: "TypeError: …",
        instruction: "names of adults",
      },
    )
    expect(messages[1].content).toContain(
      "Original instruction: names of adults",
    )
  })
})
