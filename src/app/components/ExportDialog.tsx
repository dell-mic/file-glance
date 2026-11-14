import React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Modal } from "../../components/ui/Modal"
import { Switch } from "../../components/ui/switch"
import { cn } from "@/lib/utils"
import { saveFile, trackEvent } from "@/utils"
import { useToast } from "@/hooks/use-toast"
import {
  buildCsv,
  buildExportMatrix,
  buildJson,
  buildXlsx,
  CsvExportOptions,
  ExportFormat,
  JsonExportOptions,
  XLSX_MAX_COLS,
  XLSX_MAX_ROWS,
  XlsxExportOptions,
} from "@/exportUtils"

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  /** File name without extension, used as default file/sheet name */
  fileNameBase: string
  header: any[]
  filteredRows: any[][]
  /** All rows after transformers, but before filters/search/sort */
  allRows: any[][]
  hiddenColumns: number[]
  isFiltered: boolean
}

const StorageKey = "exportDialogOptions.v1"

const defaultCsvOptions: CsvExportOptions = {
  delimiter: ",",
  lineEndings: "lf",
  quoting: "minimal",
  bom: false,
  includeHeader: true,
}

const defaultXlsxOptions: Omit<XlsxExportOptions, "sheetName"> = {
  cellType: "native",
  autofilter: false,
  includeHeader: true,
}

const defaultJsonOptions: JsonExportOptions = {
  shape: "objects",
  indent: "tab",
  includeHeader: true,
}

const presetDelimiters = [",", ";", "\t", "|"]

const formats: { id: ExportFormat; label: string }[] = [
  { id: "csv", label: "CSV" },
  { id: "xlsx", label: "Excel (XLSX)" },
  { id: "json", label: "JSON" },
]

const OptionRow: React.FC<{
  label: string
  hint?: string
  children: React.ReactNode
}> = ({ label, hint, children }) => (
  <div className="flex items-center justify-between gap-4 py-1.5">
    <div className="min-w-0">
      <div className="text-sm text-gray-700">{label}</div>
      {hint && <div className="text-xs text-gray-400">{hint}</div>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
)

const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  fileNameBase,
  header,
  filteredRows,
  allRows,
  hiddenColumns,
  isFiltered,
}) => {
  const { toast } = useToast()

  const [format, setFormat] = React.useState<ExportFormat>("csv")
  const [csvOptions, setCsvOptions] =
    React.useState<CsvExportOptions>(defaultCsvOptions)
  const [xlsxOptions, setXlsxOptions] = React.useState<XlsxExportOptions>({
    ...defaultXlsxOptions,
    sheetName: "",
  })
  const [jsonOptions, setJsonOptions] =
    React.useState<JsonExportOptions>(defaultJsonOptions)
  const [scopeFiltered, setScopeFiltered] = React.useState(true)
  const [includeHiddenColumns, setIncludeHiddenColumns] = React.useState(false)
  const [fileName, setFileName] = React.useState("")

  // Restore the last used options. The sheet name is deliberately not
  // persisted: it derives from the current file unless edited this session.
  React.useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(StorageKey) || "null")
      if (!stored) return
      if (formats.some((f) => f.id === stored.format)) {
        setFormat(stored.format)
      }
      if (stored.csv) {
        setCsvOptions({ ...defaultCsvOptions, ...stored.csv })
      }
      if (stored.json) {
        setJsonOptions({ ...defaultJsonOptions, ...stored.json })
      }
      if (stored.scope) {
        setScopeFiltered(stored.scope.scopeFiltered ?? true)
        setIncludeHiddenColumns(stored.scope.includeHiddenColumns ?? false)
      }
    } catch {
      // Corrupted storage: keep defaults
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      setFileName(fileNameBase)
      setXlsxOptions((options) => ({ ...options, sheetName: "" }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per open
  }, [open, fileNameBase])

  // Only build while open: it copies every row, too costly per render otherwise
  const matrix = open
    ? buildExportMatrix(header, filteredRows, allRows, hiddenColumns, {
        includeHiddenColumns,
        onlyFilteredRows: scopeFiltered,
      })
    : []
  const rowCount = Math.max(matrix.length - 1, 0)
  const colCount = (matrix[0] ?? []).length
  // Excel limits are inclusive; the header row counts towards the row limit
  const xlsxOverLimit =
    rowCount + (xlsxOptions.includeHeader ? 1 : 0) > XLSX_MAX_ROWS ||
    colCount > XLSX_MAX_COLS

  const fileExtension = format === "xlsx" ? "xlsx" : format

  const handleExport = React.useCallback(() => {
    const trimmedName = fileName.trim()
    if (!trimmedName || rowCount === 0) return
    if (format === "xlsx" && xlsxOverLimit) return

    try {
      let blob: Blob
      if (format === "csv") {
        blob = new Blob([buildCsv(matrix, csvOptions)], {
          type: "text/csv;charset=utf-8",
        })
      } else if (format === "xlsx") {
        blob = new Blob(
          [
            buildXlsx(matrix, {
              ...xlsxOptions,
              sheetName: xlsxOptions.sheetName || fileNameBase,
            }),
          ],
          {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        )
      } else {
        blob = new Blob([buildJson(matrix, jsonOptions)], {
          type: "application/json;charset=utf-8",
        })
      }

      saveFile(blob, `${trimmedName}.${fileExtension}`)
      toast({
        title: `${format.toUpperCase()} exported`,
        variant: "success",
      })
      trackEvent(
        "Export",
        format.toUpperCase() + (scopeFiltered ? "" : " (all rows)"),
      )
    } catch (error: any) {
      toast({
        title: error.message || String(error),
        variant: "error",
      })
      return
    }

    try {
      localStorage.setItem(
        StorageKey,
        JSON.stringify({
          format,
          csv: csvOptions,
          json: jsonOptions,
          scope: { scopeFiltered, includeHiddenColumns },
        }),
      )
    } catch {
      // Persistence is best-effort
    }
    onClose()
  }, [
    fileName,
    rowCount,
    format,
    xlsxOverLimit,
    matrix,
    csvOptions,
    xlsxOptions,
    jsonOptions,
    fileExtension,
    fileNameBase,
    scopeFiltered,
    includeHiddenColumns,
    toast,
    onClose,
  ])

  // Latest handler for the ⌘Enter shortcut without re-binding listeners
  const handleExportRef = React.useRef(handleExport)
  handleExportRef.current = handleExport

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        handleExportRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  const summary = [
    `${rowCount.toLocaleString()} rows × ${colCount.toLocaleString()} columns`,
    scopeFiltered && isFiltered
      ? `filtered from ${allRows.length.toLocaleString()}`
      : null,
    includeHiddenColumns && hiddenColumns.length > 0
      ? `incl. ${hiddenColumns.length} hidden`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Modal
      id="exportDialog"
      // Select portals render outside the modal container; a click there
      // would otherwise count as an outside click and close the dialog
      closeOnClickOutside={false}
      open={open}
      onClose={onClose}
      className="max-w-lg"
    >
      <div className="p-4">
        <h2 className="text-2xl text-gray-700 mb-4">Export</h2>

        <div className="flex gap-1 mb-4">
          {formats.map((entry) => (
            <button
              key={entry.id}
              type="button"
              data-testid={`exportFormat-${entry.id}`}
              disabled={entry.id === "xlsx" && xlsxOverLimit}
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                format === entry.id
                  ? "bg-gray-700 text-white border-gray-700"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
                entry.id === "xlsx" &&
                  xlsxOverLimit &&
                  "opacity-50 cursor-not-allowed",
              )}
              onClick={() => setFormat(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {format === "csv" && (
          <div className="mb-2">
            <OptionRow label="Delimiter">
              <div className="flex items-center gap-2">
                <Select
                  value={
                    presetDelimiters.includes(csvOptions.delimiter)
                      ? csvOptions.delimiter
                      : "custom"
                  }
                  onValueChange={(value) =>
                    setCsvOptions((options) => ({
                      ...options,
                      delimiter: value === "custom" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger
                    className="w-32"
                    data-testid="exportCsvDelimiter"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Comma ( , )</SelectItem>
                    <SelectItem value=";">Semicolon ( ; )</SelectItem>
                    <SelectItem value={"\t"}>Tab</SelectItem>
                    <SelectItem value="|">Pipe ( | )</SelectItem>
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {!presetDelimiters.includes(csvOptions.delimiter) && (
                  <Input
                    value={csvOptions.delimiter}
                    onChange={(event) =>
                      setCsvOptions((options) => ({
                        ...options,
                        delimiter: event.target.value.slice(0, 1),
                      }))
                    }
                    placeholder="~"
                    maxLength={1}
                    className="w-16 text-center"
                    data-testid="exportCsvDelimiterCustom"
                    autoFocus
                  />
                )}
              </div>
            </OptionRow>
            <OptionRow label="Line endings">
              <Select
                value={csvOptions.lineEndings}
                onValueChange={(value) =>
                  setCsvOptions((options) => ({
                    ...options,
                    lineEndings: value as CsvExportOptions["lineEndings"],
                  }))
                }
              >
                <SelectTrigger
                  className="w-40"
                  data-testid="exportCsvLineEndings"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lf">LF (Unix)</SelectItem>
                  <SelectItem value="crlf">CRLF (Windows)</SelectItem>
                </SelectContent>
              </Select>
            </OptionRow>
            <OptionRow label="Quoting">
              <Select
                value={csvOptions.quoting}
                onValueChange={(value) =>
                  setCsvOptions((options) => ({
                    ...options,
                    quoting: value as CsvExportOptions["quoting"],
                  }))
                }
              >
                <SelectTrigger className="w-40" data-testid="exportCsvQuoting">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Only when needed</SelectItem>
                  <SelectItem value="always">Always</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </OptionRow>
            <OptionRow label="UTF-8 BOM" hint="For Excel compatibility">
              <Switch
                checked={csvOptions.bom}
                onCheckedChange={(checked) =>
                  setCsvOptions((options) => ({ ...options, bom: checked }))
                }
                data-testid="exportCsvBom"
              />
            </OptionRow>
            <OptionRow label="Include header row">
              <Switch
                checked={csvOptions.includeHeader}
                onCheckedChange={(checked) =>
                  setCsvOptions((options) => ({
                    ...options,
                    includeHeader: checked,
                  }))
                }
                data-testid="exportCsvHeader"
              />
            </OptionRow>
          </div>
        )}

        {format === "xlsx" && (
          <div className="mb-2">
            <OptionRow label="Cell types">
              <Select
                value={xlsxOptions.cellType}
                onValueChange={(value) =>
                  setXlsxOptions((options) => ({
                    ...options,
                    cellType: value as XlsxExportOptions["cellType"],
                  }))
                }
              >
                <SelectTrigger
                  className="w-40"
                  data-testid="exportXlsxCellType"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="native">Native types</SelectItem>
                  <SelectItem value="text">Everything as text</SelectItem>
                </SelectContent>
              </Select>
            </OptionRow>
            <OptionRow label="Sheet name" hint="Defaults to the file name">
              <Input
                value={xlsxOptions.sheetName}
                onChange={(event) =>
                  setXlsxOptions((options) => ({
                    ...options,
                    sheetName: event.target.value,
                  }))
                }
                placeholder={fileNameBase}
                className="w-40"
                data-testid="exportXlsxSheetName"
              />
            </OptionRow>
            <OptionRow
              label="Auto-filter on header row"
              hint="Adds filter dropdowns in Excel"
            >
              <Switch
                checked={xlsxOptions.autofilter}
                onCheckedChange={(checked) =>
                  setXlsxOptions((options) => ({
                    ...options,
                    autofilter: checked,
                  }))
                }
                data-testid="exportXlsxAutofilter"
              />
            </OptionRow>
            <OptionRow label="Include header row">
              <Switch
                checked={xlsxOptions.includeHeader}
                onCheckedChange={(checked) =>
                  setXlsxOptions((options) => ({
                    ...options,
                    includeHeader: checked,
                  }))
                }
                data-testid="exportXlsxHeader"
              />
            </OptionRow>
          </div>
        )}

        {format === "json" && (
          <div className="mb-2">
            <OptionRow label="Structure">
              <Select
                value={jsonOptions.shape}
                onValueChange={(value) =>
                  setJsonOptions((options) => ({
                    ...options,
                    shape: value as JsonExportOptions["shape"],
                  }))
                }
              >
                <SelectTrigger className="w-56" data-testid="exportJsonShape">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="objects">Array of objects</SelectItem>
                  <SelectItem value="arrays">Array of arrays</SelectItem>
                  <SelectItem value="ndjson">
                    NDJSON (one object per line)
                  </SelectItem>
                </SelectContent>
              </Select>
            </OptionRow>
            <OptionRow label="Formatting">
              <Select
                value={jsonOptions.indent}
                onValueChange={(value) =>
                  setJsonOptions((options) => ({
                    ...options,
                    indent: value as JsonExportOptions["indent"],
                  }))
                }
              >
                <SelectTrigger className="w-56" data-testid="exportJsonIndent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tab">Tab-indented</SelectItem>
                  <SelectItem value="twoSpaces">2-space indented</SelectItem>
                  <SelectItem value="none">Minified</SelectItem>
                </SelectContent>
              </Select>
            </OptionRow>
            {jsonOptions.shape === "arrays" && (
              <OptionRow label="Include header row">
                <Switch
                  checked={jsonOptions.includeHeader}
                  onCheckedChange={(checked) =>
                    setJsonOptions((options) => ({
                      ...options,
                      includeHeader: checked,
                    }))
                  }
                  data-testid="exportJsonHeader"
                />
              </OptionRow>
            )}
          </div>
        )}

        <div className="border-t border-gray-200 pt-2 mt-2">
          <OptionRow
            label="Only filtered rows"
            hint={
              isFiltered
                ? `${filteredRows.length.toLocaleString()} of ${allRows.length.toLocaleString()} rows`
                : undefined
            }
          >
            <Switch
              checked={scopeFiltered}
              onCheckedChange={setScopeFiltered}
              disabled={!isFiltered}
              data-testid="exportScopeFiltered"
            />
          </OptionRow>
          <OptionRow
            label="Include hidden columns"
            hint={
              hiddenColumns.length > 0
                ? `${hiddenColumns.length} hidden`
                : undefined
            }
          >
            <Switch
              checked={includeHiddenColumns}
              onCheckedChange={setIncludeHiddenColumns}
              disabled={hiddenColumns.length === 0}
              data-testid="exportIncludeHidden"
            />
          </OptionRow>
        </div>

        <div className="text-xs text-gray-500 my-2" data-testid="exportSummary">
          {summary}
        </div>

        {format === "xlsx" && xlsxOverLimit && (
          <div className="text-red-600 text-xs mb-2">
            Too many rows or columns for XLSX (limit: 1,048,576 × 16,384).
          </div>
        )}

        <div className="flex items-center gap-2 my-2">
          <Input
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            data-testid="exportFileName"
            className="flex-1"
          />
          <span className="text-sm text-gray-500 shrink-0">
            .{fileExtension}
          </span>
        </div>

        <div className="flex justify-end gap-4 mt-4">
          <Button
            variant="ghost"
            data-testid="btnExportCancel"
            onPointerDown={onClose}
          >
            Cancel
          </Button>
          <Button
            data-testid="btnExportConfirm"
            onPointerDown={handleExport}
            disabled={
              !fileName.trim() ||
              rowCount === 0 ||
              (format === "csv" && csvOptions.delimiter === "") ||
              (format === "xlsx" && xlsxOverLimit)
            }
          >
            Export
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ExportDialog
