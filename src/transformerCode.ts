/**
 * Transformer code compilation, in its own dependency-free module so it can
 * be used from the AI eval harness (bundled for the browser) as well as the
 * app. utils.ts re-exports these for existing imports.
 */

/**
 * Simple post processing to allow code snippets without explicit return statement.
 * Simulates behavior of language like scala where the last expression is the return value (in a very naively implemented manner, though)
 * @param inputCode
 * @returns
 */
export function postProcessCode(inputCode: string): string {
  let outputCode

  // Split into lines, trim each line
  const lines = inputCode.split("\n").map((line) => line.trim())

  // Remove empty lines at the start
  while (lines.length > 0 && lines[0] === "") {
    lines.shift()
  }
  // Remove empty lines at the end
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop()
  }

  outputCode = lines.join("\n")

  // Check if the query contains a return statement (not in a comment)
  const codeWithoutComments = lines
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
  const hasReturn = /(^|[^\w])return\b/.test(codeWithoutComments)
  if (!hasReturn && lines.length > 0) {
    // Add 'return ' to the last line if missing
    lines[lines.length - 1] = "return " + lines[lines.length - 1]
    outputCode = lines.join("\n")
  }

  return outputCode
}

export function compileTransformerCode(code: string): {
  transformer: Function | null
  error: string | null
} {
  let transformer = null
  let error = null
  try {
    transformer = new Function(
      "value",
      "columnIndex",
      "rowIndex",
      "headerName",
      "allRows",
      "originalValue",
      postProcessCode(code),
    )
  } catch (err: any) {
    error = err.toString()
  }

  return {
    transformer,
    error,
  }
}
