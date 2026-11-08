import { describe, expect, test } from "bun:test"

import {
  buildTransformerMessages,
  extractCode,
  formatColumnForPrompt,
  formatSampleValues,
} from "@/ai/transformerPrompt"

describe("extractCode", () => {
  test("passes plain code through", () => {
    expect(extractCode("return value.toUpperCase()")).toBe(
      "return value.toUpperCase()",
    )
  })

  test("strips markdown fences with language tag", () => {
    expect(extractCode("```javascript\nreturn value.trim()\n```")).toBe(
      "return value.trim()",
    )
  })

  test("strips markdown fences without language tag", () => {
    expect(extractCode("```\nreturn value.trim()\n```")).toBe(
      "return value.trim()",
    )
  })

  test("strips single-line inline fences", () => {
    expect(extractCode("```return value.length```")).toBe("return value.length")
  })

  test("strips an unclosed opening fence (truncated output)", () => {
    expect(extractCode("```js\nreturn value.trim()")).toBe(
      "return value.trim()",
    )
  })
})

describe("buildTransformerMessages", () => {
  test("builds system + user message with context", () => {
    const messages = buildTransformerMessages(
      { columns: ["name (String)", "age (Number)"], sampleValues: ['"12"'] },
      "email",
      "String",
      "extract the domain",
    )
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe("system")
    expect(messages[1].role).toBe("user")
    const user = messages[1].content
    expect(user).toContain('Target column: "email" (String)')
    expect(user).toContain("Columns: name (String), age (Number)")
    expect(user).toContain('Sample values of the target column: "12"')
    expect(user).toContain("Instruction: extract the domain")
  })

  test("fix prompt includes previous code and error", () => {
    const messages = buildTransformerMessages(
      { columns: [], sampleValues: [] },
      "email",
      undefined,
      "Fix the code",
      { code: "return value.split", error: "SyntaxError: …" },
    )
    const user = messages[1].content
    expect(user).toContain("Current code:")
    expect(user).toContain("return value.split")
    expect(user).toContain("SyntaxError: …")
  })

  test("fix prompt keeps the original instruction when known", () => {
    const messages = buildTransformerMessages(
      { columns: [], sampleValues: [] },
      "email",
      undefined,
      "Fix the code",
      {
        code: "return value.split",
        error: "SyntaxError: …",
        instruction: "extract the domain",
      },
    )
    expect(messages[1].content).toContain(
      "Original instruction: extract the domain",
    )
  })
})

describe("format helpers", () => {
  test("formatColumnForPrompt appends type", () => {
    expect(formatColumnForPrompt("age", "Number")).toBe("age (Number)")
    expect(formatColumnForPrompt("age")).toBe("age")
  })

  test("formatSampleValues caps count and length", () => {
    const values = Array.from({ length: 10 }, (_, i) => "x".repeat(100) + i)
    const formatted = formatSampleValues(values)
    expect(formatted).toHaveLength(5)
    for (const formattedValue of formatted) {
      expect(formattedValue.length).toBeLessThanOrEqual(84) // 80 + quotes
    }
  })

  test("formatSampleValues handles primitives, null and objects", () => {
    expect(formatSampleValues([42, true, null, "hi", { a: 1 }])).toEqual([
      "42",
      "true",
      "null",
      '"hi"',
      // JSON.stringify of the stringified object (quotes get escaped)
      JSON.stringify('{"a":1}'),
    ])
  })
})
