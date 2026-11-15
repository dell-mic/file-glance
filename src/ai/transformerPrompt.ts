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

export function buildPromptMessages(
  system: string,
  contextLines: string[],
  instruction: string,
  previous?: FixContext,
): AiMessage[] {
  const lines = [...contextLines]
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
  return [
    { role: "system", content: system },
    { role: "user", content: lines.join("\n") },
  ]
}

export function buildTransformerMessages(
  context: TransformerAiContext,
  headerName: string,
  columnType: string | undefined,
  instruction: string,
  previous?: FixContext,
): AiMessage[] {
  return buildPromptMessages(
    systemPrompt,
    [
      `Target column: ${JSON.stringify(headerName)}${
        columnType ? ` (${columnType})` : ""
      }`,
      `Columns: ${context.columns.join(", ") || "(none)"}`,
      `Sample values of the target column: ${
        context.sampleValues.join(", ") || "(none)"
      }`,
    ],
    instruction,
    previous,
  )
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
    .map((value) => JSON.stringify(prepareValueForPrompt(value, 80)))
}

export function prepareValueForPrompt(
  value: unknown,
  maxLength: number,
): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  return truncate(stringifyValue(value), maxLength)
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
  return text.replace(
    /^\s*```(?:[a-zA-Z0-9_-]+[ \t]*(?=\r?\n))?[ \t]*\r?\n?/,
    "",
  )
}

/** Removes markdown code fences a small model may add despite instructions. */
export function extractCode(text: string) {
  const trimmed = text.trim()
  // Fenced block (with or without language tag, surrounding prose, or
  // single-line inline fence like ```return value.length``` where a leading
  // word stays part of the code instead of being mistaken for a language tag).
  const fenced = trimmed.match(/```(?:[a-zA-Z0-9_-]*[ \t]*\r?\n)?([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  // No closing fence (interrupted or truncated output): still strip the opener
  return stripOpeningFence(trimmed).trim()
}
