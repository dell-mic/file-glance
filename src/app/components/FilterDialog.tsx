import React from "react"
import { highlight, languages } from "prismjs"
import "prismjs/components/prism-clike"
import "prismjs/components/prism-javascript"
import "prismjs/themes/prism.css"
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
import { applyFilterFunction, compileFilterCode, createRowProxy } from "@/utils"
import Editor from "@/components/ui/Editor"

interface ColumnInfos {
  columnName: string
  columnValues: { value: any }[]
}

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
  // Generate example filter code based on columnValueCounts
  let exampleFilterFunctionCode = ""
  if (columnValueCounts[0]) {
    exampleFilterFunctionCode = `// (row: any[], rowIndex: number, cache = {}) => boolean\n`
    exampleFilterFunctionCode += `// For example: \n`
    exampleFilterFunctionCode += `return row[\"${columnValueCounts[0].columnName}\"] === ${JSON.stringify(columnValueCounts[0].columnValues[0]?.value)}`
  }
  if (columnValueCounts[1]) {
    exampleFilterFunctionCode += ` || row[\"${columnValueCounts[1].columnName}\"] === ${JSON.stringify(columnValueCounts[1].columnValues[columnValueCounts[1].columnValues.length - 1]?.value)}`
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
    error: string | null
    matchingRowsCount: number
  }>({
    error: null,
    matchingRowsCount: 0,
  })

  React.useEffect(() => {
    // Debounce filter function validation
    const handler = setTimeout(() => {
      if (!filterFunctionCode) {
        setFilterValidationResult({
          error: null,
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
          error: compiled.error,
          matchingRowsCount: 0,
        })
      } else {
        const cache = {}
        const count = displayedData.filter((row, i) =>
          applyFilterFunction(
            createRowProxy(row, headerRow),
            i,
            compiled.filter!,
            cache,
          ),
        ).length
        setFilterValidationResult({
          error: null,
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
          <SelectTrigger className="w-[180px] mb-2">
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
        <Editor
          data-testid={`exampleFilterCode`}
          className="w-full font-mono text-sm my-2"
          value={exampleFilterFunctionCode}
          highlight={(code) => highlight(code, languages.js, "js")}
          padding={5}
          disabled={true}
          onValueChange={() => {}}
        />
        <Editor
          data-testid={`filterCodeInput`}
          className="w-full min-h-20 bg-gray-100 border border-gray-700 border-solid font-mono text-sm my-2"
          value={filterFunctionCode}
          highlight={(code) => highlight(code, languages.js, "js")}
          padding={5}
          localStorageHistoryKey="filterFunctionCodeHistory"
          onValueChange={onFilterCodeChange}
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
