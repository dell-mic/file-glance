import { stringify as stringifyCSV } from "csv-stringify/browser/esm/sync"
import * as XLSX from "xlsx"

import { cleanWorksheetName, tableToJson } from "./utils"

// Excel hard limits:
// https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3
export const XLSX_MAX_ROWS = 1048576
export const XLSX_MAX_COLS = 16384
export const XLSX_MAX_CELL_LENGTH = 32767

export type ExportFormat = "csv" | "xlsx" | "json"

export interface CsvExportOptions {
  /** Presets: comma / semicolon / tab / pipe; any other character is allowed */
  delimiter: string
  lineEndings: "lf" | "crlf"
  quoting: "minimal" | "always" | "never"
  bom: boolean
  includeHeader: boolean
}

export interface XlsxExportOptions {
  cellType: "native" | "text"
  sheetName: string
  autofilter: boolean
  includeHeader: boolean
}

export type JsonShape = "objects" | "arrays" | "ndjson"

export interface JsonExportOptions {
  shape: JsonShape
  indent: "tab" | "twoSpaces" | "none"
  includeHeader: boolean
}

export interface ExportScopeOptions {
  includeHiddenColumns: boolean
  onlyFilteredRows: boolean
}

/**
 * Builds the export matrix `[headerRow, ...rows]` honoring the scope options:
 * hidden columns are dropped unless explicitly included, and either the
 * filtered rows (previous behavior) or all rows are used.
 */
export function buildExportMatrix(
  header: any[],
  filteredRows: any[][],
  allRows: any[][],
  hiddenColumns: number[],
  scope: ExportScopeOptions,
): any[][] {
  const rows = scope.onlyFilteredRows ? filteredRows : allRows
  if (scope.includeHiddenColumns || hiddenColumns.length === 0) {
    return [header, ...rows]
  }
  const hidden = new Set(hiddenColumns)
  const filterColumns = (row: any[]) =>
    row.filter((_, index) => !hidden.has(index))
  return [filterColumns(header), ...rows.map(filterColumns)]
}

export function buildCsv(matrix: any[][], options: CsvExportOptions): string {
  const rows = options.includeHeader ? matrix : matrix.slice(1)
  const payload = stringifyCSV(rows, {
    delimiter: options.delimiter,
    record_delimiter: options.lineEndings === "crlf" ? "\r\n" : "\n",
    ...(options.quoting === "always"
      ? { quoted: true }
      : options.quoting === "never"
        ? { quote: false }
        : {}),
    // Parity with the previous hardcoded export: booleans as "true"/"false"
    cast: { boolean: (value: boolean) => String(value) },
  })
  return options.bom ? "\uFEFF" + payload : payload
}

export function buildJson(matrix: any[][], options: JsonExportOptions): string {
  const indent =
    options.indent === "tab"
      ? "\t"
      : options.indent === "twoSpaces"
        ? "  "
        : undefined

  if (options.shape === "arrays") {
    const rows = options.includeHeader ? matrix : matrix.slice(1)
    return JSON.stringify(rows, null, indent)
  }

  // Object shapes are keyed by the header row; "include header" has no
  // meaning there (the header becomes the keys, never a data row).
  const objects = tableToJson([...matrix]) // tableToJson mutates via shift
  if (options.shape === "ndjson") {
    return objects.map((object) => JSON.stringify(object)).join("\n")
  }
  return JSON.stringify(objects, null, indent)
}

export function buildXlsx(
  matrix: any[][],
  options: XlsxExportOptions,
): Uint8Array<ArrayBuffer> {
  const rows = (options.includeHeader ? matrix : matrix.slice(1)).map((row) =>
    row.map((value) => {
      let cell = Array.isArray(value) ? String(value) : value
      if (options.cellType === "text" && typeof cell !== "string") {
        cell = String(cell)
      }
      if (typeof cell === "string" && cell.length > XLSX_MAX_CELL_LENGTH) {
        cell = cell.substring(0, XLSX_MAX_CELL_LENGTH)
      }
      return cell
    }),
  )

  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  if (options.autofilter && rows.length > 0) {
    const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0)
    if (colCount > 0) {
      worksheet["!autofilter"] = {
        ref: XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: { r: rows.length - 1, c: colCount - 1 },
        }),
      }
    }
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    cleanWorksheetName(options.sheetName),
  )
  // BlobPart typing wants Uint8Array<ArrayBuffer>; re-wrapping is safe for
  // both an ArrayBuffer and a typed array result
  return new Uint8Array(
    XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      compression: true,
    }) as ArrayBuffer,
  )
}
