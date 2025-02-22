export interface MarkdownParsingResult {
  headerRow: string[]
  rows: string[][]
}

export function isMarkdownTable(input: string): boolean {
  const nonEmptyLines = input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")

  // A valid table needs at least two lines (header and separator rows)
  if (nonEmptyLines.length < 2) {
    return false
  }

  // If there is any row in there not starting with | we do not consider this a markdown table
  for (let i = 0; i < nonEmptyLines.length; i++) {
    const row = nonEmptyLines[i]
    if (!row.startsWith("|")) {
      return false
    }
  }

  return true
}

export function parseMarkdownTable(text: string): MarkdownParsingResult {
  const lines = [...text.split("\n")]
    .map((s) => s.trim())
    .filter((l) => l.length)
  if (lines[0] === "") lines.shift()
  if (lines[lines.length - 1] === "") lines.pop()

  if (lines.length === 0) {
    throw new SyntaxError("Text is empty")
  }

  if (!lines[0].includes("|")) {
    throw new SyntaxError("Text is empty")
  }

  const headers = lines[0].split("|").map((x) => x.trim())
  const leftBound = headers[0] === ""
  const rightBound = headers[headers.length - 1] === ""
  if (leftBound) headers.shift()
  if (rightBound) headers.pop()

  const rows = iterateRowsSync(lines.slice(1), { leftBound, rightBound })

  return { headerRow: headers, rows: rows }
}

export function stringifyMarkdownTable(data: any[][]): string {
  const headerRow = data.shift()!

  // Convert single row into a Markdown row string
  const formatRow = (row: string[]) => {
    let result = "| "
    for (const value of row) {
      const escapedValue =
        typeof value === "string" ? value.replaceAll("|", "\\|") : value
      result += escapedValue + " | "
    }
    return result
  }

  const headerSeparator = `| ${headerRow.map(() => "---").join(" | ")} |`

  let output = formatRow(headerRow) + "\n" + headerSeparator + "\n"
  for (const row of data) {
    output += formatRow(row) + "\n"
  }

  return output.trim()
}

function iterateRowsSync(
  lines: Iterable<string>,
  options: TableIterationOptions,
): string[][] {
  const { leftBound, rightBound } = options
  const rows = []

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (horizontalLineRegex.test(trimmedLine)) continue

    const row = trimmedLine.split("|").map((x) => x.trim())

    if (leftBound && row.shift() !== "") {
      throw new SyntaxError("Inconsistent left bound")
    }

    if (rightBound && row.pop() !== "") {
      throw new SyntaxError("Inconsistent right bound")
    }
    rows.push(row)
  }
  return rows
}

interface TableIterationOptions {
  readonly leftBound: boolean
  readonly rightBound: boolean
}

const horizontalLineRegex = /^[| -]+$/
