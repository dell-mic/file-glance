import { sum, uniq } from "lodash"
import React from "react"
import AutoSizer from "react-virtualized-auto-sizer"

import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/20/solid"

import { CogIcon as CogIconMicro } from "@heroicons/react/16/solid"
import { BookmarkSlashIcon } from "@heroicons/react/24/outline"

import { highlight, languages } from "prismjs"
import "prismjs/components/prism-clike"
import "prismjs/components/prism-javascript"
import "prismjs/themes/prism.css" //Example style, you can use another

import "./DataTable.css"

import { ColumnInfos } from "./ValueInspector"
import { MenuPopover } from "./Popover"
import useWindowDimensions from "../hooks/useWindowDimensions"
import { SortSetting } from "../home-page"
import { Modal } from "./Modal"
import Editor from "react-simple-code-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select"
import { Button } from "./button"
import { innerElementType, Row, StickyList } from "./VirtualizedList"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { compileTransformerCode } from "@/utils"

export interface SortEvent {
  columnIndex: number
  sortOrder: "asc" | "desc" | "unsorted"
}

export interface TransformerAddedEvent {
  columnIndex: number
  transformerFunctionCode: string
  transformer: Function
  asNewColumn: boolean
  newColumnName: string
}

interface TransformerSampleResult {
  value: any
  result: string | null
  error: string | null
}
interface TransformerValidation {
  compilationError: string | null
  sampleResults: TransformerSampleResult[]
}

export const DataTable = (props: {
  headerRow: string[]
  rows: Array<Array<any>>
  columnValueCounts: ColumnInfos[]
  hiddenColumns: number[]
  sortSetting: SortSetting | null
  onSortingChange: (e: SortEvent) => void
  onTransformerAdded: (e: TransformerAddedEvent) => void
}) => {
  const TransformerFunctionComment =
    "// (value, columnIndex, rowIndex, headerName, allRows, originalValue) =>\n"

  const { width: windowWidth } = useWindowDimensions()

  const { toast } = useToast()

  // console.log(rows)
  const rows = [props.headerRow, ...props.rows]
  const hiddenColumns = props.hiddenColumns

  const columnWidths = props.columnValueCounts.map((cvc) =>
    !hiddenColumns.includes(cvc.columnIndex)
      ? estimateColumnWidthPx(cvc.valuesMaxLength)
      : 0,
  )
  const columnWidthSum = sum(columnWidths)

  const leftColumnWidthPx = 380 + 24 // TODO: Hardcoded width for value inspector + padding/scrollbar etc; would better be dynamic

  const remainingWidth = windowWidth - leftColumnWidthPx - columnWidthSum

  const growthFactor = (remainingWidth * 1.0) / columnWidthSum + 1
  const MinGrowthFactor = 1
  const MaxGrowthFactor = 1.77
  const growFactorEffective = Math.min(
    Math.max(growthFactor, MinGrowthFactor),
    MaxGrowthFactor,
  )
  // console.log("growthFactor", growthFactor)
  // console.log("growFactorEffective", growFactorEffective)

  const tableWidth = `${columnWidthSum * growFactorEffective}px`
  const sColumnWidths = columnWidths.map(
    (cw) => `${cw * growFactorEffective}px`,
  )

  const [popoverAnchorElement, setPopoverAnchorElement] =
    React.useState<HTMLElement | null>(null)
  const [popoverColumnIndex, setPopoverColumnIndex] = React.useState<
    number | null
  >(null)
  const [transformModalOpen, setTransformModalOpen] =
    React.useState<boolean>(false)
  const [transformerFunctionCode, setTransformerFunctionCode] =
    React.useState<string>(TransformerFunctionComment)

  const [transformerValidation, setTransformerValidation] =
    React.useState<TransformerValidation | null>(null)

  const [targetType, setTargetType] = React.useState<"current" | "new">(
    "current",
  )

  const [newColName, setNewColName] = React.useState<string>("")

  const handleTransformModalClose = () => {
    setTransformModalOpen(false)
    setTransformerFunctionCode(TransformerFunctionComment)
    setTransformerValidation(null)
    setTargetType("current")
  }

  const handlePopoverClose = () => {
    // console.log("handlePopoverClose")
    setPopoverAnchorElement(null)
  }

  // console.log("Datatable - anchorEl", anchorEl)

  const handleTransformerSelected = (value: string) => {
    switch (value) {
      case "custom":
        handleTransformerCodeChanged(TransformerFunctionComment)
        break
      case "uppercase":
        handleTransformerCodeChanged("return value.toUpperCase()")
        break
      case "lowercase":
        handleTransformerCodeChanged("return value.toLowerCase()")
        break
      case "trim":
        handleTransformerCodeChanged("return value.trim()")
        break
      case "emaildomain":
        handleTransformerCodeChanged("return value.split('@')[1] || ''")
        break
      case "parseint":
        handleTransformerCodeChanged("return parseInt(value, 10)")
        break
      case "parsefloat":
        handleTransformerCodeChanged("return parseFloat(value)")
        break
      case "parse_unix_ts":
        handleTransformerCodeChanged(
          "return new Date(Number(value) * 1000).toISOString()",
        )
        break
      default:
        console.error("Unexpected select option value: " + value)
        break
    }
  }

  const handleTransformerCodeChanged = (code: string) => {
    // TODO: Could be debounced?
    // console.log("code", code)
    setTransformerFunctionCode(code)

    const { transformer, error } = compileTransformerCode(code)
    if (transformer) {
      const sampleValues = sampleValuesFromArray(
        props.columnValueCounts
          .find((cvc) => cvc.columnIndex === popoverColumnIndex)!
          .columnValues.map((cv) => cv.value)
          .slice()
          .sort(),
      )

      const sampleResults = sampleValues.map((value, index) => {
        let result
        let error

        try {
          result = transformer(
            value,
            popoverColumnIndex,
            index,
            props.headerRow[popoverColumnIndex!],
            value, // TODO: How to pass actual originalValue?
          )
        } catch (err: any) {
          error = err.toString()
        }

        return {
          value,
          result,
          error,
        }
      })

      console.log("sampleResults", sampleResults)
      setTransformerValidation({
        compilationError: null,
        sampleResults: sampleResults,
      })
    } else if (error) {
      setTransformerValidation({
        compilationError: error,
        sampleResults: [],
      })
    } else {
      throw "This should never happen: Should either get compiled transformer or error!"
    }
  }

  const popoverColumnsIsSorted =
    props.sortSetting && props.sortSetting.columnIndex === popoverColumnIndex
  const sortOrder = props.sortSetting?.sortOrder

  const popoverEntries = [
    [
      {
        text:
          popoverColumnsIsSorted && sortOrder === "asc"
            ? "Undo sort"
            : "Sort ascending",
        icon:
          popoverColumnsIsSorted && sortOrder === "asc" ? (
            <BookmarkSlashIcon />
          ) : (
            <ArrowUpIcon />
          ),

        onSelect: () => {
          props.onSortingChange({
            columnIndex: popoverColumnIndex!,
            sortOrder:
              popoverColumnsIsSorted && sortOrder === "asc"
                ? "unsorted"
                : "asc",
          })
        },
      },
      {
        text:
          popoverColumnsIsSorted && sortOrder === "desc"
            ? "Undo sort"
            : "Sort descending",
        icon:
          popoverColumnsIsSorted && sortOrder === "desc" ? (
            <BookmarkSlashIcon />
          ) : (
            <ArrowDownIcon />
          ),
        onSelect: () => {
          props.onSortingChange({
            columnIndex: popoverColumnIndex!,
            sortOrder:
              popoverColumnsIsSorted && sortOrder === "desc"
                ? "unsorted"
                : "desc",
          })
        },
      },
    ],
    [
      {
        text: "Copy column name",
        icon: <ClipboardDocumentCheckIcon />,
        onSelect: () => {
          navigator.clipboard.writeText(props.headerRow[popoverColumnIndex!])
        },
      },
      {
        text: "Copy values",
        icon: <ClipboardDocumentListIcon />,
        onSelect: () => {
          navigator.clipboard.writeText(
            props.rows.map((row) => row[popoverColumnIndex!]).join("\n"),
          )
        },
      },
      {
        text: "Copy values (unique)",
        icon: <ClipboardDocumentListIcon />,
        onSelect: () => {
          navigator.clipboard.writeText(
            uniq(props.rows.map((row) => row[popoverColumnIndex!])).join("\n"),
          )
        },
      },
    ],
    [
      {
        text: "Transform",
        icon: <CogIconMicro />,
        onSelect: () => {
          setTransformModalOpen(true)
          setNewColName(props.headerRow[popoverColumnIndex!] + " Trans")
          handleTransformerCodeChanged(transformerFunctionCode)
        },
      },
    ],
  ]

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden border border-gray-300 rounded-md shadow-xs">
      <MenuPopover
        id={"columnPopover"}
        menuItems={popoverEntries}
        open={Boolean(popoverAnchorElement)}
        anchorEl={popoverAnchorElement}
        onClose={handlePopoverClose}
        onSelect={() => setPopoverAnchorElement(null)}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
      ></MenuPopover>
      <Modal
        id="columnTransformDialog"
        closeOnClickOutside={false}
        open={transformModalOpen}
        onClose={() => {
          handleTransformModalClose()
        }}
      >
        <div>
          <h2 className="m-auto text-2xl text-gray-700 mb-4">
            Transform Column: {props.headerRow[popoverColumnIndex!]}
          </h2>

          <div className="mb-4">
            <Label>Apply transformation to</Label>
            <RadioGroup
              value={targetType}
              onValueChange={(v: "current" | "new") => setTargetType(v)}
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
                      onChange={(e) => setNewColName(e.target.value)}
                      // onFocus={e => e.target.select()}
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
              <SelectItem value="parse_unix_ts">
                Parse UNIX Timestamp
              </SelectItem>
              <SelectSeparator />
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Editor
            data-testid={`transformCodeInput`}
            className="w-full h-20 bg-gray-100 border border-gray-700 border-solid font-mono text-sm my-2"
            value={transformerFunctionCode}
            highlight={(code) => highlight(code, languages.js, "js")}
            padding={5}
            onValueChange={handleTransformerCodeChanged}
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
                {transformerValidation?.sampleResults.map((sample, index) => (
                  <tr key={index} className="even:bg-gray-100 font-mono">
                    <td className="border border-gray-300 px-2 py-1 overflow-hidden">
                      {JSON.stringify(sample.value)}
                    </td>
                    <td
                      className={`border border-gray-300 px-2 py-1 overflow-hidden ${
                        sample.error ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {sample.error
                        ? sample.error
                        : JSON.stringify(sample.result)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-4 mt-4">
            <Button
              data-testid="btnTransfomCancel"
              variant="ghost"
              onPointerDown={() => handleTransformModalClose()}
            >
              Cancel
            </Button>
            <Button
              data-testid="btnTransformApply"
              onPointerDown={() => {
                const { transformer } = compileTransformerCode(
                  transformerFunctionCode,
                )

                if (transformer) {
                  props.onTransformerAdded({
                    columnIndex: popoverColumnIndex!,
                    transformerFunctionCode: transformerFunctionCode,
                    transformer,
                    asNewColumn: targetType === "new",
                    newColumnName: newColName,
                  })
                  handleTransformModalClose()
                } else {
                  // TODO: Error handling
                }
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </Modal>
      {/* TODO: Last line hidden in case of horizontal scrolling */}
      <AutoSizer disableWidth>
        {({ height }) => (
          // @ts-ignore
          <StickyList
            data-testid="dataTable"
            className=""
            innerElementType={innerElementType}
            stickyIndices={[0]}
            height={height}
            itemCount={rows.length}
            itemSize={20}
            overscanCount={50}
            width={tableWidth}
            hiddenColumns={hiddenColumns}
            rows={rows}
            headerRow={props.headerRow}
            columnsWidths={sColumnWidths}
            sortSetting={props.sortSetting}
            onHeaderPressed={({ columnIndex }) => {
              let newSortOrder: SortEvent["sortOrder"] = "asc"
              if (props.sortSetting?.columnIndex === columnIndex) {
                if (props.sortSetting?.sortOrder === "desc") {
                  newSortOrder = "unsorted"
                } else if (props.sortSetting?.sortOrder === "asc") {
                  newSortOrder = "desc"
                }
              }

              props.onSortingChange({
                columnIndex: columnIndex,
                sortOrder: newSortOrder,
              })
              setPopoverAnchorElement(null)
            }}
            onHeaderMenuPressed={({ columnIndex, headerElement }) => {
              setPopoverAnchorElement(headerElement)
              setPopoverColumnIndex(columnIndex)
            }}
            onValueCellPressed={({ valueAsString }) => {
              navigator.clipboard.writeText(valueAsString)
              toast({
                title: "Value copied to clipboard",
              })
            }}
          >
            {Row}
          </StickyList>
        )}
      </AutoSizer>
    </div>
  )
}

function estimateColumnWidthPx(valueMaxLength: number): number {
  if (valueMaxLength <= 6) {
    return 64
  } else if (valueMaxLength <= 15) {
    return 128
  } else {
    return 192
  }
}

function sampleValuesFromArray(data: any[]) {
  if (data.length <= 5) return data

  const beginning = data.slice(0, 2)
  const middle = [data[Math.floor((data.length - 1) / 2)]]
  const ending = data.slice(-2)

  return [...beginning, ...middle, ...ending]
}
