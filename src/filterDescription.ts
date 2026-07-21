import { ColumnFilter, parseSearch } from "./utils"

/**
 * Structured, UI-agnostic description of all active filters.
 * Mirrors the semantics of `applyFilters` in utils.ts:
 * - facet include/exclude per column (exact match on stringified values)
 * - empty facet value matches null/undefined/"" (and empty arrays)
 * - global or column-scoped substring search ("columnName:value" syntax)
 * - custom JavaScript filter function
 */
export type FilterClause =
  | { kind: "include"; column: string; values: string[] }
  | { kind: "exclude"; column: string; values: string[] }
  | { kind: "search"; column: string | null; term: string }
  | { kind: "function"; code: string }

export function columnNameFallback(columnIndex: number): string {
  return "col_" + `${columnIndex + 1}`.padStart(2, "0")
}

function columnName(headerRow: string[], columnIndex: number): string {
  return headerRow[columnIndex] || columnNameFallback(columnIndex)
}

export function describeFilters(
  headerRow: string[],
  filters: ColumnFilter[],
  search: string,
  appliedFilterFunctionCode: string | null,
): FilterClause[] {
  const clauses: FilterClause[] = []

  for (const filter of filters) {
    const included = filter.filterValues
      .filter((fv) => fv.included)
      .map((fv) => fv.value)
    const excluded = filter.filterValues
      .filter((fv) => !fv.included)
      .map((fv) => fv.value)
    const column = columnName(headerRow, filter.columnIndex)
    if (included.length) {
      clauses.push({ kind: "include", column, values: included })
    }
    if (excluded.length) {
      clauses.push({ kind: "exclude", column, values: excluded })
    }
  }

  if (search.length) {
    // Same parsing as applyFilters (shared parseSearch helper)
    const { columnIndex, term } = parseSearch(search, headerRow)
    clauses.push({
      kind: "search",
      column: columnIndex !== null ? columnName(headerRow, columnIndex) : null,
      term,
    })
  }

  if (appliedFilterFunctionCode) {
    clauses.push({ kind: "function", code: appliedFilterFunctionCode })
  }

  return clauses
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function equalityClause(column: string, values: string[]): string {
  return values.length === 1
    ? `${column} = ${quote(values[0])}`
    : `${column} IN (${values.map(quote).join(", ")})`
}

/** Renders one clause as a pseudo-SQL line. */
export function clauseToPseudoSql(clause: FilterClause): string {
  switch (clause.kind) {
    case "include": {
      const values = clause.values.filter((v) => v !== "")
      const parts: string[] = []
      if (values.length) parts.push(equalityClause(clause.column, values))
      if (values.length < clause.values.length)
        parts.push(`${clause.column} IS EMPTY`)
      return parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0]
    }
    case "exclude": {
      // The "hide" label already carries the negation, so describe the
      // (positive) condition selecting the hidden rows: a row is hidden if
      // it matches ANY exclude value (OR semantics, see applyFilters)
      const values = clause.values.filter((v) => v !== "")
      const parts: string[] = []
      if (values.length) parts.push(equalityClause(clause.column, values))
      if (values.length < clause.values.length)
        parts.push(`${clause.column} IS EMPTY`)
      return parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0]
    }
    case "search":
      return `${clause.column ?? "*"} CONTAINS ${quote(clause.term)}`
    case "function":
      return "matches custom JavaScript filter"
  }
}
