// Eval set for measuring NL -> transformer-code generation quality.
// Each task has machine-checkable expected results, so pass@1 can be scored
// automatically through the same compile+apply path the app uses.
//
// Task design rules (learned from the first run):
// - Expected outputs must be unambiguous (a model producing "45,123" instead
//   of "45.1k" is a spec problem, not a model problem).
// - Tasks must not overlap with the few-shot example in transformerPrompt.ts
//   (pattern copying would inflate the example variant's score).

import {
  formatColumnForPrompt,
  formatSampleValues,
} from "@/ai/transformerPrompt"

export type EvalCategory = "text" | "number" | "logic"

export interface EvalSample {
  value: unknown
  /** Predicate the transformed result must satisfy */
  check: (result: any) => boolean
}

export interface EvalTask {
  id: string
  category: EvalCategory
  instruction: string
  headerName: string
  columnType?: string
  columns: Array<{ name: string; type?: string }>
  samples: EvalSample[]
}

/** Score one generated transformer body against a task's samples. */
export function scoreGeneratedCode(
  code: string,
  task: EvalTask,
  compileTransformerCode: (code: string) => {
    transformer: Function | null
    error: string | null
  },
): { pass: boolean; error: string | null; sampleErrors: Array<string | null> } {
  const { transformer, error } = compileTransformerCode(code)
  if (!transformer) {
    return { pass: false, error, sampleErrors: [] }
  }
  const sampleErrors: Array<string | null> = []
  let pass = true
  task.samples.forEach((sample, index) => {
    let result: unknown
    let sampleError: string | null = null
    try {
      result = transformer.apply({}, [
        sample.value,
        index,
        index,
        task.headerName,
        [],
        sample.value,
      ])
    } catch (err: any) {
      sampleError = err?.toString() ?? String(err)
    }
    if (typeof result === "function") {
      sampleError = "Transformer returned a function"
      result = undefined
    }
    // Models sometimes hedge a scalar result in a one-element array. The app
    // spreads arrays into columns, so a single-element array behaves like the
    // scalar — accept it.
    if (!sample.check(result) && Array.isArray(result) && result.length === 1) {
      result = result[0]
    }
    if (!sampleError && !sample.check(result)) {
      sampleError = `Unexpected result: ${JSON.stringify(result)}`
    }
    sampleErrors.push(sampleError)
    if (sampleError) pass = false
  })
  return { pass, error: null, sampleErrors }
}

/** Context (columns + sample values) the harness sends with each task. */
export function taskPromptContext(task: EvalTask) {
  return {
    columns: task.columns.map((c) => formatColumnForPrompt(c.name, c.type)),
    sampleValues: formatSampleValues(task.samples.map((s) => s.value)),
  }
}

const nameColumn = { name: "name", type: "String" }
const emailColumn = { name: "email", type: "String" }

const isNumber = (r: any, expected: number) => Number(r) === expected
const isArray = (r: any, expected: unknown[]) =>
  Array.isArray(r) && JSON.stringify(r) === JSON.stringify(expected)

export const evalTasks: EvalTask[] = [
  // --- text ---
  {
    id: "uppercase",
    category: "text",
    instruction: "convert the value to uppercase letters",
    headerName: "city",
    columnType: "String",
    columns: [nameColumn, { name: "city", type: "String" }],
    samples: [{ value: "hello world", check: (r) => r === "HELLO WORLD" }],
  },
  {
    id: "lowercase",
    category: "text",
    instruction: "convert the value to lowercase letters",
    headerName: "city",
    columnType: "String",
    columns: [nameColumn, { name: "city", type: "String" }],
    samples: [{ value: "HeLLo", check: (r) => r === "hello" }],
  },
  {
    id: "trim",
    category: "text",
    instruction: "remove leading and trailing whitespace from the value",
    headerName: "comment",
    columnType: "String",
    columns: [nameColumn, { name: "comment", type: "String" }],
    samples: [{ value: "  data  ", check: (r) => r === "data" }],
  },
  {
    id: "trim-lowercase",
    category: "text",
    instruction: "trim whitespace from the value and convert it to lowercase",
    headerName: "tag",
    columnType: "String",
    columns: [nameColumn, { name: "tag", type: "String" }],
    samples: [{ value: "  DaTa  ", check: (r) => r === "data" }],
  },
  {
    id: "email-domain",
    category: "text",
    instruction: "extract the domain, i.e. exactly the part after the @ sign",
    headerName: "email",
    columnType: "String",
    columns: [nameColumn, emailColumn],
    samples: [
      { value: "jane.doe@example.org", check: (r) => r === "example.org" },
    ],
  },
  {
    id: "email-local",
    category: "text",
    instruction:
      "extract the local part, i.e. exactly the part before the @ sign",
    headerName: "email",
    columnType: "String",
    columns: [nameColumn, emailColumn],
    samples: [
      { value: "jane.doe@example.org", check: (r) => r === "jane.doe" },
    ],
  },
  {
    id: "split-name",
    category: "text",
    instruction:
      "split the full name at the space and return an array with exactly two values: first name and last name",
    headerName: "name",
    columnType: "String",
    columns: [nameColumn, emailColumn],
    samples: [
      { value: "Ada Lovelace", check: (r) => isArray(r, ["Ada", "Lovelace"]) },
    ],
  },
  {
    id: "first-word",
    category: "text",
    instruction: "return the first word of the text",
    headerName: "address",
    columnType: "String",
    columns: [nameColumn, { name: "address", type: "String" }],
    samples: [{ value: "New York City", check: (r) => r === "New" }],
  },
  {
    id: "last-word",
    category: "text",
    instruction: "return the last word of the text",
    headerName: "address",
    columnType: "String",
    columns: [nameColumn, { name: "address", type: "String" }],
    samples: [{ value: "New York City", check: (r) => r === "City" }],
  },
  {
    id: "file-extension",
    category: "text",
    instruction:
      "return the file extension, i.e. the part of the filename after the last dot (without the dot)",
    headerName: "filename",
    columnType: "String",
    columns: [nameColumn, { name: "filename", type: "String" }],
    samples: [{ value: "logo.png", check: (r) => r === "png" }],
  },
  {
    id: "filename-without-extension",
    category: "text",
    instruction:
      "return the filename without its extension, i.e. everything before the last dot",
    headerName: "filename",
    columnType: "String",
    columns: [nameColumn, { name: "filename", type: "String" }],
    samples: [{ value: "logo.png", check: (r) => r === "logo" }],
  },
  {
    id: "initials",
    category: "text",
    instruction:
      "return the initials: the first character of each word, converted to uppercase, joined together with nothing in between",
    headerName: "name",
    columnType: "String",
    columns: [nameColumn, emailColumn],
    samples: [{ value: "Ada Lovelace", check: (r) => r === "AL" }],
  },
  {
    id: "digits-only",
    category: "text",
    instruction: "remove everything that is not a digit from the value",
    headerName: "order_ref",
    columnType: "String",
    columns: [nameColumn, { name: "order_ref", type: "String" }],
    samples: [{ value: "Order #12345", check: (r) => r === "12345" }],
  },
  {
    id: "reverse",
    category: "text",
    instruction: "reverse the order of the characters in the value",
    headerName: "code",
    columnType: "String",
    columns: [nameColumn, { name: "code", type: "String" }],
    samples: [{ value: "abc", check: (r) => r === "cba" }],
  },
  {
    id: "spaces-to-underscores",
    category: "text",
    instruction: "replace every space in the value with an underscore",
    headerName: "slug",
    columnType: "String",
    columns: [nameColumn, { name: "slug", type: "String" }],
    samples: [{ value: "new york city", check: (r) => r === "new_york_city" }],
  },
  {
    id: "capitalize-first",
    category: "text",
    instruction:
      "uppercase the first character of the value and leave the remaining characters unchanged",
    headerName: "title",
    columnType: "String",
    columns: [nameColumn, { name: "title", type: "String" }],
    samples: [{ value: "hello world", check: (r) => r === "Hello world" }],
  },
  {
    id: "remove-vowels",
    category: "text",
    instruction: "remove all vowels (a, e, i, o, u) from the value",
    headerName: "word",
    columnType: "String",
    columns: [nameColumn, { name: "word", type: "String" }],
    samples: [{ value: "hello", check: (r) => r === "hll" }],
  },
  {
    id: "last-first",
    category: "text",
    instruction:
      'reformat the full name "First Last" as "Last, First" (last name, comma, space, first name)',
    headerName: "name",
    columnType: "String",
    columns: [nameColumn, emailColumn],
    samples: [{ value: "Ada Lovelace", check: (r) => r === "Lovelace, Ada" }],
  },
  {
    id: "truncate-5",
    category: "text",
    instruction: "shorten the value to at most 5 characters",
    headerName: "snippet",
    columnType: "String",
    columns: [nameColumn, { name: "snippet", type: "String" }],
    samples: [{ value: "abcdefg", check: (r) => r === "abcde" }],
  },
  {
    id: "char-count",
    category: "text",
    instruction: "return the number of characters in the value",
    headerName: "word",
    columnType: "String",
    columns: [nameColumn, { name: "word", type: "String" }],
    samples: [{ value: "hello", check: (r) => isNumber(r, 5) }],
  },
  {
    id: "word-count",
    category: "text",
    instruction:
      "return the number of words in the value (words are separated by spaces)",
    headerName: "address",
    columnType: "String",
    columns: [nameColumn, { name: "address", type: "String" }],
    samples: [{ value: "New York City", check: (r) => isNumber(r, 3) }],
  },
  {
    id: "snake-to-camel",
    category: "text",
    instruction:
      "convert snake_case to camelCase: remove the underscores and uppercase the letter that followed each underscore",
    headerName: "field",
    columnType: "String",
    columns: [nameColumn, { name: "field", type: "String" }],
    samples: [{ value: "first_name", check: (r) => r === "firstName" }],
  },
  {
    id: "strip-protocol",
    category: "text",
    instruction:
      "remove the protocol prefix (https:// or http://) from the URL",
    headerName: "website",
    columnType: "String",
    columns: [nameColumn, { name: "website", type: "String" }],
    samples: [
      { value: "https://example.com/x", check: (r) => r === "example.com/x" },
    ],
  },
  {
    id: "comma-split-trimmed",
    category: "text",
    instruction:
      "split the value on commas and return an array of the trimmed parts",
    headerName: "tags",
    columnType: "String",
    columns: [nameColumn, { name: "tags", type: "String" }],
    samples: [{ value: "a, b ,c", check: (r) => isArray(r, ["a", "b", "c"]) }],
  },
  {
    id: "sorted-split",
    category: "text",
    instruction:
      "split the value on commas and return an array of the parts sorted alphabetically",
    headerName: "tags",
    columnType: "String",
    columns: [nameColumn, { name: "tags", type: "String" }],
    samples: [{ value: "b,a", check: (r) => isArray(r, ["a", "b"]) }],
  },

  // --- number ---
  {
    id: "parse-int",
    category: "number",
    instruction: "convert the value to an integer number",
    headerName: "quantity",
    columnType: "String",
    columns: [nameColumn, { name: "quantity", type: "String" }],
    samples: [{ value: "42", check: (r) => isNumber(r, 42) }],
  },
  {
    id: "double",
    category: "number",
    instruction: "double the numeric value",
    headerName: "visits",
    columnType: "Number",
    columns: [nameColumn, { name: "visits", type: "Number" }],
    samples: [{ value: 21, check: (r) => isNumber(r, 42) }],
  },
  {
    id: "round-money",
    category: "number",
    instruction: "round the price to 2 decimal places",
    headerName: "price",
    columnType: "String",
    columns: [nameColumn, { name: "price", type: "String" }],
    samples: [{ value: "19.987", check: (r) => isNumber(r, 19.99) }],
  },
  {
    id: "dollars-to-cents",
    category: "number",
    instruction:
      "convert the price in dollars to cents, i.e. multiply by 100 and round to the nearest integer",
    headerName: "price",
    columnType: "Number",
    columns: [nameColumn, { name: "price", type: "Number" }],
    samples: [{ value: 19.99, check: (r) => isNumber(r, 1999) }],
  },
  {
    id: "absolute-value",
    category: "number",
    instruction: "return the absolute value (remove a possible minus sign)",
    headerName: "delta",
    columnType: "Number",
    columns: [nameColumn, { name: "delta", type: "Number" }],
    samples: [{ value: -5, check: (r) => isNumber(r, 5) }],
  },
  {
    id: "clamp-100",
    category: "number",
    instruction:
      "cap the value at 100: return 100 if the value is greater than 100, otherwise return the value unchanged",
    headerName: "score",
    columnType: "Number",
    columns: [nameColumn, { name: "score", type: "Number" }],
    samples: [
      { value: 150, check: (r) => isNumber(r, 100) },
      { value: 42, check: (r) => isNumber(r, 42) },
    ],
  },
  {
    id: "percentage",
    category: "number",
    instruction:
      "convert the fraction to a percentage: multiply by 100 and round to the nearest integer",
    headerName: "share",
    columnType: "Number",
    columns: [nameColumn, { name: "share", type: "Number" }],
    samples: [{ value: 0.25, check: (r) => isNumber(r, 25) }],
  },
  {
    id: "format-thousands",
    category: "number",
    instruction:
      'format the number with a comma as thousands separator, e.g. 45123 becomes "45,123"',
    headerName: "salary",
    columnType: "Number",
    columns: [nameColumn, { name: "salary", type: "Number" }],
    samples: [{ value: 45123, check: (r) => String(r) === "45,123" }],
  },
  {
    id: "hours-to-minutes",
    category: "number",
    instruction: "convert hours to minutes (multiply by 60)",
    headerName: "duration_h",
    columnType: "Number",
    columns: [nameColumn, { name: "duration_h", type: "Number" }],
    samples: [{ value: 2.5, check: (r) => isNumber(r, 150) }],
  },
  {
    id: "zero-pad",
    category: "number",
    instruction:
      "format the id as a string with leading zeros so it is exactly 5 characters long",
    headerName: "id",
    columnType: "Number",
    columns: [{ name: "id", type: "Number" }, nameColumn],
    samples: [{ value: 42, check: (r) => String(r) === "00042" }],
  },

  // --- logic ---
  {
    id: "active-flag",
    category: "logic",
    instruction:
      "return the boolean true if the value is exactly the text 'active', and the boolean false otherwise",
    headerName: "status",
    columnType: "String",
    columns: [nameColumn, { name: "status", type: "String" }],
    samples: [
      { value: "active", check: (r) => r === true },
      { value: "inactive", check: (r) => r === false },
    ],
  },
  {
    id: "fill-unknown",
    category: "logic",
    instruction:
      "if the value is null, undefined or an empty string, return the text 'unknown'; otherwise return the value unchanged",
    headerName: "middle_name",
    columnType: "String",
    columns: [nameColumn, { name: "middle_name", type: "String" }],
    samples: [
      { value: null, check: (r) => r === "unknown" },
      { value: "", check: (r) => r === "unknown" },
      { value: "Ray", check: (r) => r === "Ray" },
    ],
  },
  {
    id: "empty-to-null",
    category: "logic",
    instruction:
      "if the value is an empty string, return null; otherwise return the value unchanged",
    headerName: "middle_name",
    columnType: "String",
    columns: [nameColumn, { name: "middle_name", type: "String" }],
    samples: [
      { value: "", check: (r) => r === null },
      { value: "Ray", check: (r) => r === "Ray" },
    ],
  },
  {
    id: "bool-yes-no",
    category: "logic",
    instruction:
      "if the boolean value is true, return the text 'yes'; if it is false, return the text 'no'",
    headerName: "verified",
    columnType: "Boolean",
    columns: [nameColumn, { name: "verified", type: "Boolean" }],
    samples: [
      { value: true, check: (r) => r === "yes" },
      { value: false, check: (r) => r === "no" },
    ],
  },
  {
    id: "index-prefix",
    category: "logic",
    instruction:
      "prefix the value with the row index, a colon and a space (use the rowIndex parameter)",
    headerName: "note",
    columnType: "String",
    columns: [nameColumn, { name: "note", type: "String" }],
    samples: [
      { value: "a", check: (r) => r === "0: a" },
      { value: "b", check: (r) => r === "1: b" },
    ],
  },
]
