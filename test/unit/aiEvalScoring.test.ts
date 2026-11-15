import { describe, expect, test } from "bun:test"

import { compileTransformerCode } from "@/transformerCode"
import { evalTasks, scoreGeneratedCode } from "../../scripts/ai-eval/evalSet"

// Sanity-check the eval judge itself: it must accept correct code and reject
// broken code, using the exact same compile path as the app.
describe("scoreGeneratedCode", () => {
  const task = evalTasks.find((t) => t.id === "email-domain")!

  test("accepts correct code", () => {
    const scored = scoreGeneratedCode(
      `return String(value).split("@")[1]`,
      task,
      compileTransformerCode,
    )
    expect(scored.pass).toBe(true)
    expect(scored.error).toBeNull()
  })

  test("rejects compile errors", () => {
    const scored = scoreGeneratedCode(
      "return value.split(",
      task,
      compileTransformerCode,
    )
    expect(scored.pass).toBe(false)
    expect(scored.error).not.toBeNull()
  })

  test("rejects wrong results", () => {
    const scored = scoreGeneratedCode(
      `return value`,
      task,
      compileTransformerCode,
    )
    expect(scored.pass).toBe(false)
    expect(scored.sampleErrors[0]).toContain("Unexpected result")
  })

  test("rejects runtime errors (string method on number)", () => {
    const numberTask = evalTasks.find((t) => t.id === "format-thousands")!
    const scored = scoreGeneratedCode(
      `return value.replace(/(\\d+)/, (m) => m + "k")`,
      numberTask,
      compileTransformerCode,
    )
    expect(scored.pass).toBe(false)
    expect(scored.sampleErrors[0]).toContain("TypeError")
  })

  test("accepts a correct scalar wrapped in a one-element array", () => {
    const scored = scoreGeneratedCode(
      `return [String(value).split("@")[1]]`,
      task,
      compileTransformerCode,
    )
    expect(scored.pass).toBe(true)
  })

  test("rejects strip-protocol code that hardcodes https:// length on http:// holdout", () => {
    const stripTask = evalTasks.find((t) => t.id === "strip-protocol")!
    const scored = scoreGeneratedCode(
      `return value.startsWith("https://") || value.startsWith("http://") ? value.substring(8) : value`,
      stripTask,
      compileTransformerCode,
    )
    expect(scored.pass).toBe(false)
  })

  test("scores filter and freeQuery eval tasks", () => {
    const filterTask = evalTasks.find((t) => t.id === "filter-adults")!
    expect(
      scoreGeneratedCode(
        `return Number(row["age"]) >= 18`,
        filterTask,
        compileTransformerCode,
      ).pass,
    ).toBe(true)
    expect(
      scoreGeneratedCode(
        `return Number(row["age"]) < 18`,
        filterTask,
        compileTransformerCode,
      ).pass,
    ).toBe(false)

    const queryTask = evalTasks.find((t) => t.id === "query-count-country")!
    expect(
      scoreGeneratedCode(
        `return data.filter((r) => r["country"] === "USA").length`,
        queryTask,
        compileTransformerCode,
      ).pass,
    ).toBe(true)
  })
})
