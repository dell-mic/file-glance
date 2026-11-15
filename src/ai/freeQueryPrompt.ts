// Prompt construction for NL -> free query code. The query function receives
// the whole table and returns an arbitrary result (array, object, string...).

import type { AiMessage } from "@/ai/aiWorkerProtocol"
import { type FixContext } from "@/ai/transformerPrompt"
import { formatSampleRow } from "@/ai/filterPrompt"

export interface FreeQueryAiContext {
  /** e.g. 'name (String)' entries, already truncated by the caller */
  columns: string[]
  /** JSON object string of the first displayed row */
  sampleRow: string
}

const systemPrompt = `You convert natural-language instructions into the body of a JavaScript function that queries a table.

The function's parameters are:
- data: all rows of the table, each an array of cell values, e.g. data[0][1]
- headers: array of column names, aligned with the row arrays

Rules:
- Output ONLY the function body as plain JavaScript statements, usually a single "return ..." line.
- The body must return the requested result: typically an array of rows or values, an object, or a string.
- No function wrapper, no markdown fences, no explanations.
- Standard ES2020 JavaScript only, no imports.
- To access a cell by column name, use row[headers.indexOf("Name")].
- Cell values may be numbers, strings, booleans, null or undefined. Convert types explicitly (e.g. String(value)) before using string methods.
- Keep the result small: limit and map rows instead of returning the whole table unless asked.`

export function buildFreeQueryMessages(
  context: FreeQueryAiContext,
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
