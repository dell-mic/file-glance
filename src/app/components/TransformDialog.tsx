import React from "react"
import { highlight, languages } from "prismjs"
import Editor from "react-simple-code-editor"
import "prismjs/components/prism-clike"
import "prismjs/components/prism-javascript"
import "prismjs/themes/prism.css"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { Button } from "../../components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Modal } from "../../components/ui/Modal"

interface TransformerValidation {
  compilationError: string | null
  sampleResults: Array<{
    value: any
    result: string | null
    error: string | null
  }>
}

interface TransformDialogProps {
  open: boolean
  headerName: string
  targetType: "current" | "new"
  newColName: string
  transformerFunctionCode: string
  transformerValidation: TransformerValidation | null
  onClose: () => void
  onTargetTypeChange: (value: "current" | "new") => void
  onNewColNameChange: (value: string) => void
  onTransformerCodeChange: (code: string) => void
  onApply: () => void
}

const TransformDialog: React.FC<TransformDialogProps> = ({
  open,
  headerName,
  targetType,
  newColName,
  transformerFunctionCode,
  transformerValidation,
  onClose,
  onTargetTypeChange,
  onNewColNameChange,
  onTransformerCodeChange,
  onApply,
}) => {
  const handleTransformerSelected = (value: string) => {
    switch (value) {
      case "custom":
        onTransformerCodeChange("return value")
        break
      case "uppercase":
        onTransformerCodeChange("return value.toUpperCase()")
        break
      case "lowercase":
        onTransformerCodeChange("return value.toLowerCase()")
        break
      case "trim":
        onTransformerCodeChange("return value.trim()")
        break
      case "emaildomain":
        onTransformerCodeChange("return value.split('@')[1] || ''")
        break
      case "parseint":
        onTransformerCodeChange("return parseInt(value, 10)")
        break
      case "parsefloat":
        onTransformerCodeChange("return parseFloat(value)")
        break
      case "parse_unix_ts":
        onTransformerCodeChange(
          "return new Date(Number(value) * 1000).toISOString()",
        )
        break
      default:
        console.error("Unexpected select option value: " + value)
        break
    }
  }

  return (
    <Modal
      id="columnTransformDialog"
      closeOnClickOutside={false}
      open={open}
      onClose={onClose}
    >
      <div>
        <h2 className="m-auto text-2xl text-gray-700 mb-4">
          Transform Column: {headerName}
        </h2>

        <div className="mb-4">
          <Label>Apply transformation to</Label>
          <RadioGroup
            value={targetType}
            onValueChange={onTargetTypeChange}
            className="flex items-center min-h-9 space-x-4"
          >
            <div className="flex flex-row items-center space-x-2">
              <RadioGroupItem
                value="current"
                id="current"
                data-testid={`transform-current`}
              />
              <Label htmlFor="current">Current column</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="new"
                id="new"
                data-testid={`transform-new`}
              />
              <Label htmlFor="new">
                New column{targetType === "new" ? ":" : ""}
              </Label>
              {targetType === "new" && (
                <div>
                  <Input
                    id="newColumnName"
                    data-testid={`transform-newColumnName`}
                    value={newColName}
                    onChange={(e) => onNewColNameChange(e.target.value)}
                    placeholder="e.g. name_cleaned"
                    required
                  />
                </div>
              )}
            </div>
          </RadioGroup>
        </div>

        <Select onValueChange={handleTransformerSelected}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Transformer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trim">Trim</SelectItem>
            <SelectItem value="uppercase">Uppercase</SelectItem>
            <SelectItem value="lowercase">Lowercase</SelectItem>
            <SelectItem value="emaildomain">Domain from Email</SelectItem>
            <SelectSeparator />
            <SelectItem value="parseint">Parse Integer</SelectItem>
            <SelectItem value="parsefloat">Parse Float</SelectItem>
            <SelectItem value="parse_unix_ts">Parse UNIX Timestamp</SelectItem>
            <SelectSeparator />
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Editor
          data-testid={`transformCodeHints`}
          className="w-full font-mono text-sm"
          value={
            "// (value, columnIndex, rowIndex, headerName, allRows, originalValue) =>"
          }
          highlight={(code) => highlight(code, languages.js, "js")}
          padding={5}
          disabled={true}
          onValueChange={() => {}}
        />
        <Editor
          data-testid={`transformCodeInput`}
          className="w-full min-h-20 bg-gray-100 border border-gray-700 border-solid font-mono text-sm mb-2"
          value={transformerFunctionCode}
          highlight={(code) => highlight(code, languages.js, "js")}
          padding={5}
          onValueChange={onTransformerCodeChange}
        ></Editor>
        <div className="h-52 w-full mt-4">
          <h3 className="text-xl">Preview</h3>
          {transformerValidation?.compilationError && (
            <div className="text-red-600 font-medium my-10 text-center">
              Compilation Error: {transformerValidation?.compilationError}
            </div>
          )}

          <table
            className="w-full border-collapse table-fixed text-sm"
            style={{
              display: transformerValidation?.compilationError
                ? "none"
                : "table",
            }}
          >
            <thead>
              <tr>
                <th className="border border-gray-300 px-2 py-1 text-left">
                  Value
                </th>
                <th className="border border-gray-300 px-2 py-1 text-left">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {transformerValidation?.sampleResults.map((sample, index) => {
                const sampleRender = JSON.stringify(sample.value)

                const resultRender = sample.error
                  ? sample.error
                  : JSON.stringify(sample.result)
                return (
                  <tr
                    key={index}
                    className="even:bg-gray-100 font-mono whitespace-nowrap"
                  >
                    <td
                      className="border border-gray-300 px-2 py-1 overflow-hidden"
                      title={sampleRender}
                    >
                      {sampleRender}
                    </td>
                    <td
                      className={`border border-gray-300 px-2 py-1 overflow-hidden ${
                        sample.error ? "text-red-600" : "text-green-600"
                      }`}
                      title={resultRender}
                    >
                      {resultRender}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-4 mt-4">
          <Button
            data-testid="btnTransfomCancel"
            variant="ghost"
            onPointerDown={onClose}
          >
            Cancel
          </Button>
          <Button data-testid="btnTransformApply" onPointerDown={onApply}>
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default TransformDialog
