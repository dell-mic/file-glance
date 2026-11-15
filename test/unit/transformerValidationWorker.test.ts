import { describe, expect, test } from "bun:test"

// Importing the worker file registers its message listener, which is harmless
// under the test runner.
import { applyTransformer } from "@/worker/transformerValidationWorker"

describe("applyTransformer", () => {
  test("function results are reported as errors, not returned", () => {
    const data = [{ value: "a@b.com", preTransformValue: "a@b.com" }]
    const validation = applyTransformer("return value.split", 0, "email", data)
    expect(validation.compilationError).toBeNull()
    expect(validation.sampleResults[0].result).toBeUndefined()
    expect(validation.sampleResults[0].error).toContain("returned a function")
  })

  test("normal results pass through", () => {
    const data = [{ value: "a@b.com", preTransformValue: "a@b.com" }]
    const validation = applyTransformer(
      "return value.split('@')[1]",
      0,
      "email",
      data,
    )
    expect(validation.sampleResults[0].result).toBe("b.com")
    expect(validation.sampleResults[0].error).toBeUndefined()
  })

  test("passes sample rows array as 5th argument allRows", () => {
    const data = [
      { value: 10, preTransformValue: 10 },
      { value: 30, preTransformValue: 30 },
    ]
    const validation = applyTransformer(
      "return value / allRows.length + allRows[rowIndex][columnIndex]",
      2,
      "score",
      data,
    )
    expect(validation.compilationError).toBeNull()
    expect(validation.sampleResults[0].result).toBe(15)
    expect(validation.sampleResults[1].result).toBe(45)
  })
})
