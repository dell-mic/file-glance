// Prompt construction for NL -> filter code. Filter functions return a
// boolean per row; `row` is a proxy accessible by column name and `cache`
// persists across rows.

import type { AiMessage } from "@/ai/aiWorkerProtocol"
import { prepareValueForPrompt, type FixContext } from "@/ai/transformerPrompt"

export interface FilterAiContext {
  /** e.g. 'name (String)' entries, already truncated by the caller */
  columns: string[]
  /** JSON object string of the first displayed row */
  sampleRow: string
}

const systemPrompt = `You convert natural-language instructions into the body of a JavaScript filter function for a table.

The function's parameters are:
- row: one row of the table; access cells by column name, e.g. row["age"]
- rowIndex: number, position of the row
- cache: an empty object that persists across all rows; use it to precompute shared state (e.g. a Set of already seen keys)

Rules:
- Output ONLY the function body as plain JavaScript statements, usually a single "return ..." line.
- The body must return a boolean: true to keep the row, false to drop it.
- No function wrapper, no markdown fences, no explanations.
- Standard ES2020 JavaScript only, no imports.
- Cell values may be numbers, strings, booleans, null or undefined. Convert types explicitly (e.g. String(value)) before using string methods.`

export function buildFilterMessages(
  context: FilterAiContext,
  instruction: string,
  previous?: FixContext,
): AiMessage[] {
  const lines = [
    `Columns: ${context.columns.join(", ") || "(none)"}`,
    `Sample row: ${context.sampleRow || "(none)"}`,
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

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: lines.join("\n") },
  ]
}

/** JSON object string of a row for the prompt, capped in columns and value length. */
export function formatSampleRow(
  row: unknown[],
  headerRow: string[],
  maxColumns = 40,
) {
  const object: Record<string, string | number | boolean | null> = {}
  const count = Math.min(row.length, headerRow.length, maxColumns)
  for (let i = 0; i < count; i++) {
    object[headerRow[i]] = prepareValueForPrompt(row[i], 40)
  }
  return JSON.stringify(object)
}
