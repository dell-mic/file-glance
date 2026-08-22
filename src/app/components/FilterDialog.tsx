import React from "react"
import { Button } from "../../components/ui/button"
import { Modal } from "../../components/ui/Modal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import {
  buildRowTypeLib,
  compileFilterCode,
  createRowProxy,
  renderValuePreview,
} from "@/utils"
import CodeEditor from "@/components/ui/CodeEditor"
import type { ColumnInfos } from "@/app/components/ValueInspector"

interface FilterDialogProps {
  open: boolean
  filterFunctionCode: string
  columnValueCounts: ColumnInfos[]
  headerRow: string[]
  displayedData: any[][]
  onClose: () => void
  onFilterCodeChange: (code: string) => void
  onApply: (code: string) => void
}

const FilterFunctionCodeHistoryKey = "filterFunctionCodeHistory"

// Variables available in the filter function body, for autocomplete. `row`
// is declared with per-column types so Monaco's TS language service can
// complete column names and (for typed columns) their methods.
const filterLibUri = "ts:fileglance/filter-params.d.ts"

function buildFilterParamsLib(
  headerRow: string[],
  columnValueCounts: ColumnInfos[],
) {
  const rowLib = buildRowTypeLib(filterLibUri, headerRow, columnValueCounts)
  return {
    uri: filterLibUri,
    content: `${rowLib.content}declare var rowIndex: number
declare var cache: Record<string, any>
`,
  }
}

const FilterDialog: React.FC<FilterDialogProps> = ({
  open,
  filterFunctionCode,
  columnValueCounts,
  headerRow,
  displayedData,
  onClose,
  onFilterCodeChange,
  onApply,
}) => {
  const filterParamsLib = React.useMemo(
    () => buildFilterParamsLib(headerRow, columnValueCounts),
    [headerRow, columnValueCounts],
  )

  // Generate example filter code based on columnValueCounts
  let exampleFilterFunctionCode = ""
  if (columnValueCounts[0]) {
    exampleFilterFunctionCode = `// (row: any[], rowIndex: number, cache = {}) => boolean\n`
    exampleFilterFunctionCode += `// For example: \n`
    exampleFilterFunctionCode += `return row[\"${columnValueCounts[0].columnName}\"] === ${renderValuePreview(columnValueCounts[0].columnValues[0]?.value)}`
  }
  if (columnValueCounts[1]) {
    exampleFilterFunctionCode += ` || row[\"${columnValueCounts[1].columnName}\"] === ${renderValuePreview(columnValueCounts[1].columnValues[columnValueCounts[1].columnValues.length - 1]?.value)}`
  }

  // Calculate topX based on displayedData length
  let topX = 5
  if (displayedData.length > 100) {
    const magnitude = Math.pow(
      10,
      Math.max(0, Math.floor(Math.log10(displayedData.length)) - 1),
    )
    topX = magnitude
  }

  const handleFilterSelected = (value: string) => {
    switch (value) {
      case "custom":
        onFilterCodeChange("return true")
        break
      case "remove_duplicates":
        onFilterCodeChange(`// Which columns to take into account
const compareCols = ${JSON.stringify(headerRow)};

cache.seen = cache.seen ?? new Set();
const key = JSON.stringify(compareCols.map(col => row[col]));
if (cache.seen.has(key)) {
  return false;
} else {
  cache.seen.add(key);
  return true;
}`)
        break
      case "complete_rows_only":
        onFilterCodeChange(
          `// Which columns to take into account\nconst requiredCols = ${JSON.stringify(
            headerRow,
          )};\n\nreturn requiredCols.every(col => {\n  const v = row[col];\n  return v !== undefined && v !== null && String(v).trim() !== "";\n});`,
        )
        break
      case "top_x":
        onFilterCodeChange(`// Keep only the first TOP ${topX} rows
return rowIndex < ${topX}`)
        break
      default:
        console.error("Unexpected select option value: " + value)
        break
    }
  }

  const [filterValidationResult, setFilterValidationResult] = React.useState<{
    // The code this result was computed for. Validation is debounced, so
    // Apply must additionally check that the result matches the current code
    // — otherwise it would stay enabled on a stale result for 500ms and
    // could apply (and close the dialog with) invalid code.
    code: string | null
    error: string | null
    /** First runtime error encountered while test-applying the filter to rows, if any */
    rowError: string | null
    matchingRowsCount: number
  }>({
    code: null,
    error: null,
    rowError: null,
    matchingRowsCount: 0,
  })

  React.useEffect(() => {
    // Debounce filter function validation
    const handler = setTimeout(() => {
      if (!filterFunctionCode) {
        setFilterValidationResult({
          code: filterFunctionCode,
          error: null,
          rowError: null,
          matchingRowsCount: 0,
        })
        return
      }
      const compiled = compileFilterCode(
        filterFunctionCode,
        createRowProxy(displayedData[0], headerRow),
      )
      if (compiled.error) {
        setFilterValidationResult({
          code: filterFunctionCode,
          error: compiled.error,
          rowError: null,
          matchingRowsCount: 0,
        })
      } else {
        const cache = {}
        // Evaluate rows directly (instead of via applyFilterFunction) so that
        // runtime errors can be surfaced here instead of only being logged to
        // the console. Erroring rows count as non-matching, exactly like
        // applyFilterFunction treats them.
        let firstRowError: string | null = null
        let count = 0
        displayedData.forEach((row, i) => {
          try {
            if (compiled.filter!(createRowProxy(row, headerRow), i, cache)) {
              count++
            }
          } catch (err: any) {
            if (firstRowError === null) firstRowError = err.toString()
          }
        })
        setFilterValidationResult({
          code: filterFunctionCode,
          error: null,
          rowError: firstRowError,
          matchingRowsCount: count,
        })
      }
    }, 500)

    return () => clearTimeout(handler)
  }, [filterFunctionCode, displayedData, headerRow])

  return (
    <Modal
      id="filterDialog"
      closeOnClickOutside={false}
      open={open}
      onClose={onClose}
    >
      <div>
        <h2 className="m-auto text-2xl text-gray-700 mb-4">Filter Rows</h2>
        <Select onValueChange={handleFilterSelected}>
          <SelectTrigger className="w-45 mb-2">
            <SelectValue placeholder="Filter function" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="remove_duplicates">Remove Duplicates</SelectItem>
            <SelectItem value="complete_rows_only">
              Complete Rows Only
            </SelectItem>
            <SelectItem value="top_x">Top {topX}</SelectItem>
            <SelectSeparator />
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <pre
          data-testid={`exampleFilterCode`}
          className="w-full font-mono text-sm my-2 p-[5px] whitespace-pre-wrap"
        >
          {exampleFilterFunctionCode}
        </pre>
        <CodeEditor
          data-testid={`filterCodeInput`}
          className="w-full min-h-20 bg-gray-100 border border-gray-700 border-solid font-mono text-sm my-2"
          value={filterFunctionCode}
          onValueChange={onFilterCodeChange}
          localStorageHistoryKey={FilterFunctionCodeHistoryKey}
          grayBackground
          path="inmemory://model/filter.js"
          extraLib={filterParamsLib}
        />
        {filterValidationResult.error ? (
          <div className="text-red-600 font-medium">
            {filterValidationResult.error}
          </div>
        ) : (
          <div className="">
            <span className="">Matching rows: </span>
            <span className="font-bold">
              {filterValidationResult.matchingRowsCount}
            </span>
            {filterValidationResult.rowError && (
              <div className="text-red-600 font-medium">
                {filterValidationResult.rowError}
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-4 mt-4">
          <Button
            data-testid="btnFilterCancel"
            variant="ghost"
            onPointerDown={onClose}
          >
            Cancel
          </Button>
          <Button
            data-testid="btnFilterApply"
            onPointerDown={() => onApply(filterFunctionCode)}
            disabled={
              filterValidationResult.code !== filterFunctionCode ||
              !!filterValidationResult.error ||
              filterValidationResult.matchingRowsCount === 0
            }
          >
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default FilterDialog
