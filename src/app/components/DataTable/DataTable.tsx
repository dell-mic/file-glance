import { sum, uniq } from "lodash-es"
import React, { createRef, useEffect, useState } from "react"
import AutoSizer from "react-virtualized-auto-sizer"

import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/20/solid"

import { CogIcon as CogIconMicro } from "@heroicons/react/16/solid"
import { BookmarkSlashIcon } from "@heroicons/react/24/outline"

import "./DataTable.css"

import { ColumnInfos } from "../ValueInspector"
import { MenuPopover } from "../../../components/ui/Popover"
import useWindowDimensions from "../../../hooks/useWindowDimensions"
import { SortSetting } from "../../home-page"
import { innerElementType, Row, StickyList } from "./VirtualizedList"
import { useToast } from "@/hooks/use-toast"
import { compileTransformerCode } from "@/utils"
import TransformDialog from "../TransformDialog"
import useKeyPress from "@/hooks/useKeyPress"
import { FixedSizeList } from "react-window"

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
  const { width: windowWidth } = useWindowDimensions()

  const { toast } = useToast()
  const isMetaPressed = useKeyPress("Meta")

  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [navigationDirection, setNavigationDirection] = useState<
    "up" | "down" | null
  >(null)

  const listRef = createRef<FixedSizeList>()

  // console.log(rows)
  const rows = [props.headerRow, ...props.rows]
  const hiddenColumns = props.hiddenColumns

  const RowHeight = 20 // px
  const OverScanScroll = 5

  // reset selection when rows change (e.g. when sorted)
  useEffect(() => {
    setSelectedRow(null)
    setNavigationDirection(null)
  }, [props.rows])

  // Adjust scroll position when selected column near out of displayed range
  useEffect(() => {
    if (
      listRef?.current &&
      selectedRow !== null &&
      navigationDirection !== null
    ) {
      const scrollToRow =
        navigationDirection === "up"
          ? Math.max(selectedRow - OverScanScroll, 0)
          : Math.min(selectedRow + OverScanScroll, rows.length - 1)
      listRef.current.scrollToItem(scrollToRow)
      // console.log("listRef.current.scrollToItem", scrollToRow, selectedRow, listRef, navigationDirection, rows.length)
    }
    // TODO: Fix liniting complaint / maybe refactor to useCallback?
  }, [selectedRow, listRef.current, navigationDirection, rows.length])

  const columnWidths = props.columnValueCounts.map((cvc) =>
    !hiddenColumns.includes(cvc.columnIndex)
      ? estimateColumnWidthPx(cvc.valuesMaxLength)
      : 0,
  )
  const columnWidthSum = sum(columnWidths)

  const leftColumnWidthPx = 380 + 24 // TODO: Hardcoded width for value inspector + padding/scrollbar etc; would better be dynamic

  const remainingWidth = windowWidth - leftColumnWidthPx - columnWidthSum
  // console.log("remainingWidth", remainingWidth)
  const isOverFlowingHorizontally = remainingWidth < 0

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
    React.useState<string>("")

  const [transformerValidation, setTransformerValidation] =
    React.useState<TransformerValidation | null>(null)

  const [targetType, setTargetType] = React.useState<"current" | "new">(
    "current",
  )

  const [newColName, setNewColName] = React.useState<string>("")

  const handleTransformModalClose = () => {
    setTransformModalOpen(false)
    setTransformerFunctionCode("")
    setTransformerValidation(null)
    setTargetType("current")
  }

  const handlePopoverClose = () => {
    // console.log("handlePopoverClose")
    setPopoverAnchorElement(null)
  }

  // console.log("Datatable - anchorEl", anchorEl)

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

      // console.log("sampleResults", sampleResults)
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
        onSelect: async () => {
          await navigator.clipboard.writeText(
            props.rows.map((row) => row[popoverColumnIndex!]).join("\n"),
          )
          toast({
            title: "Values copied to clipboard",
          })
        },
      },
      {
        text: "Copy values (unique)",
        icon: <ClipboardDocumentListIcon />,
        onSelect: async () => {
          await navigator.clipboard.writeText(
            uniq(props.rows.map((row) => row[popoverColumnIndex!])).join("\n"),
          )
          toast({
            title: "Values copied to clipboard",
          })
        },
      },
      {
        text: "Copy values (unique, JS array)",
        icon: <ClipboardDocumentListIcon />,
        onSelect: async () => {
          await navigator.clipboard.writeText(
            JSON.stringify(
              uniq(props.rows.map((row) => row[popoverColumnIndex!])),
            ),
          )
          toast({
            title: "Values copied to clipboard",
          })
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

  const handleKeyDown: React.KeyboardEventHandler = async (e) => {
    // console.log(e)

    if (!selectedRow) return

    // Actual rows start with 1 because header is technically a row here
    if (e.key === "ArrowUp" && selectedRow > 1) {
      e.preventDefault()
      setNavigationDirection("up")
      setSelectedRow(selectedRow - 1)
    } else if (e.key === "ArrowDown" && selectedRow < rows.length - 1) {
      e.preventDefault()
      setNavigationDirection("down")
      setSelectedRow(selectedRow + 1)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setNavigationDirection(null)
      setSelectedRow(null)
    } else if (e.key === "Enter") {
      if (e.metaKey) {
        const rowObj = Object.fromEntries(
          props.headerRow.map((header, i) => [
            header,
            props.rows[selectedRow - 1][i],
          ]),
        )
        await navigator.clipboard.writeText(JSON.stringify(rowObj))
        toast({
          title: "Row values copied to clipboard",
          description: "as JSON",
        })
      } else {
        await navigator.clipboard.writeText(
          props.rows[selectedRow - 1].join("\t"),
        )
        toast({
          title: "Row values copied to clipboard",
          description: "as tab separated",
        })
      }
    }
  }

  return (
    <div
      className="data-table h-full overflow-x-auto overflow-y-hidden border border-gray-300 rounded-md shadow-xs"
      style={{
        paddingBottom: isOverFlowingHorizontally ? RowHeight : undefined, // Make space for horizontal scrollbar, such that it does not overlap content
      }}
      data-testid="DataTable"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {!!popoverAnchorElement && (
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
      )}
      {transformModalOpen && (
        <TransformDialog
          open={transformModalOpen}
          headerName={props.headerRow[popoverColumnIndex!]}
          targetType={targetType}
          newColName={newColName}
          transformerFunctionCode={transformerFunctionCode}
          transformerValidation={transformerValidation}
          onClose={handleTransformModalClose}
          onTargetTypeChange={setTargetType}
          onNewColNameChange={setNewColName}
          onTransformerCodeChange={handleTransformerCodeChanged}
          onApply={() => {
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
        />
      )}
      {/* TODO: Last line hidden in case of horizontal scrolling */}
      <AutoSizer disableWidth>
        {({ height }) => (
          // @ts-ignore
          <StickyList
            className=""
            ref={listRef}
            innerElementType={innerElementType}
            stickyIndices={[0]}
            height={height}
            itemCount={rows.length}
            itemSize={RowHeight}
            overscanCount={50}
            width={tableWidth}
            hiddenColumns={hiddenColumns}
            rows={rows}
            selectedRow={selectedRow}
            headerRow={props.headerRow}
            columnsWidths={sColumnWidths}
            sortSetting={props.sortSetting}
            isMetaPressed={isMetaPressed}
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
            onValueCellPressed={({ value }) => {
              //console.log(`'${value}'`)
              navigator.clipboard.writeText("" + value)
              toast({
                title: "Value copied to clipboard",
              })
            }}
            onRowSelected={({ rowIndex }) => {
              // console.log(rowIndex, rowData)
              setSelectedRow(rowIndex !== selectedRow ? rowIndex : null)
              setNavigationDirection(null)
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
