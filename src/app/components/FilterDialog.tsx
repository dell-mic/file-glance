import React from "react"
import { highlight, languages } from "prismjs"
import Editor from "react-simple-code-editor"
import "prismjs/components/prism-clike"
import "prismjs/components/prism-javascript"
import "prismjs/themes/prism.css"
import { Button } from "./button"
import { Modal } from "./Modal"

interface FilterDialogProps {
  open: boolean
  exampleFilterFunctionCode: string
  filterFunctionCode: string
  matchingRowsCount: number
  filterValidationError?: string | null
  onClose: () => void
  onFilterCodeChange: (code: string) => void
  onApply: (code: string) => void
}

const FilterDialog: React.FC<FilterDialogProps> = ({
  open,
  exampleFilterFunctionCode,
  filterFunctionCode,
  matchingRowsCount,
  filterValidationError,
  onClose,
  onFilterCodeChange,
  onApply,
}) => {
  return (
    <Modal
      id="filterDialog"
      closeOnClickOutside={false}
      open={open}
      onClose={onClose}
    >
      <div>
        <h2 className="m-auto text-2xl text-gray-700 mb-4">Filter Rows</h2>
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
          onValueChange={onFilterCodeChange}
        />
        {filterValidationError ? (
          <div className="text-red-600 font-medium">
            {filterValidationError}
          </div>
        ) : (
          <div className="">
            <span className="">Matching rows: </span>
            <span className="font-bold">{matchingRowsCount}</span>
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
            disabled={!!filterValidationError || matchingRowsCount === 0}
          >
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default FilterDialog
