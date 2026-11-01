// Prompt construction for NL -> transformer code, plus extraction of the
// code from the model's answer. Pure functions, unit-tested.

import type { AiMessage } from "@/ai/aiWorkerProtocol"

export interface TransformerAiContext {
  /** e.g. 'name (String)' entries, already truncated by the caller */
  columns: string[]
  /** stringified sample values of the target column, already truncated */
  sampleValues: string[]
}

const systemPrompt = `You convert natural-language instructions into the body of a JavaScript function that transforms one cell value in a table.

The function's parameters are:
- value: the current cell value
- columnIndex, rowIndex: number
- headerName: string, name of the column
- allRows: all rows of the table as arrays
- originalValue: the cell value before previously applied transformers

Rules:
- Output ONLY the function body as plain JavaScript statements, usually a single "return ..." line.
- No function wrapper, no markdown fences, no explanations.
- Standard ES2020 JavaScript only, no imports.
- To split a value into multiple cells, return an array of values.
- value may be a number, string, boolean, null or undefined. Convert its type explicitly (e.g. String(value)) before using string methods.`

export interface FixContext {
  code: string
  error: string
  /** Instruction that produced the code, when it came from AI generation */
  instruction?: string
}

export function buildTransformerMessages(
  context: TransformerAiContext,
  headerName: string,
  columnType: string | undefined,
  instruction: string,
  previous?: FixContext,
  options?: { example?: boolean },
): AiMessage[] {
  const lines = [
    `Target column: ${JSON.stringify(headerName)}${
      columnType ? ` (${columnType})` : ""
    }`,
    `Columns: ${context.columns.join(", ") || "(none)"}`,
    `Sample values of the target column: ${
      context.sampleValues.join(", ") || "(none)"
    }`,
  ]
  if (previous) {
    lines.push(
      `Current code:`,
      previous.code,
      `The code failed with this error:`,
      previous.error,
    )
    if (previous.instruction) {
      // The error alone can be satisfied by any syntactically valid rewrite;
      // the original instruction anchors the fix to what was asked.
      lines.push(`Original instruction: ${previous.instruction}`)
    }
  }
  lines.push(
    previous
      ? `Instruction: rewrite the code so the error is gone.`
      : `Instruction: ${instruction}`,
  )

  const messages: AiMessage[] = [{ role: "system", content: systemPrompt }]
  if (options?.example) {
    // One worked example, as an assistant turn: small models imitate turns
    // better than they follow rules. Deliberately different from typical
    // requests to avoid pattern copying.
    messages.push(
      {
        role: "user",
        content: `Target column: "date_of_birth" (String)
Columns: name (String), date_of_birth (String)
Sample values of the target column: "1990-05-01"
Instruction: extract the year as a number`,
      },
      {
        role: "assistant",
        content: `return Number(String(value).split("-")[0])`,
      },
    )
  }
  messages.push({ role: "user", content: lines.join("\n") })
  return messages
}

/** Column entry for the prompt, capped so wide files cannot blow up the prompt. */
export function formatColumnForPrompt(name: string, columnType?: string) {
  const type = columnType ? ` (${columnType})` : ""
  return `${truncate(name, 40)}${type}`
}

/** Stringified sample value for the prompt: capped in count and length. */
export function formatSampleValues(values: unknown[], maxValues = 5) {
  return values
    .slice(0, maxValues)
    .map((value) => JSON.stringify(truncate(stringifyValue(value), 80)))
}

export function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return String(value)
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function truncate(text: string, maxLength: number) {
  return text.length <= maxLength ? text : text.slice(0, maxLength - 1) + "…"
}

/** Strip a leading markdown fence while the answer is still streaming in. */
export function stripOpeningFence(text: string) {
  // The language tag is only consumed when followed by a newline — otherwise
  // "```return x" would lose "return" as a pseudo language tag.
  return text.replace(/^\s*```(?:\w+(?=\n))?\n?/, "")
}

/** Removes markdown code fences a small model may add despite instructions. */
export function extractCode(text: string) {
  const trimmed = text.trim()
  // Multi-line, with or without language tag: ```lang\n...\n```
  const multiline = trimmed.match(/^```\w*\n([\s\S]*?)\n?```$/)
  if (multiline) return multiline[1].trim()
  // Single-line inline fence: ```return value.length``` — a leading word must
  // stay part of the code, not be mistaken for a language tag.
  const inline = trimmed.match(/^```([\s\S]*?)```$/)
  if (inline) return inline[1].trim()
  // No closing fence (interrupted or truncated output): still strip the opener
  return stripOpeningFence(trimmed).trim()
}
