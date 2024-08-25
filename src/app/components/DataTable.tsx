import { sum, uniq } from "lodash"
import React, { createContext, forwardRef } from "react"
import { FixedSizeList } from "react-window"
import AutoSizer from "react-virtualized-auto-sizer"

import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/20/solid"

import {
  ArrowUpIcon as ArrowUpIconMicro,
  ArrowDownIcon as ArrowDownIconMicro,
  CogIcon as CogIconMicro,
} from "@heroicons/react/16/solid"
import { BookmarkSlashIcon } from "@heroicons/react/24/outline"

import "./DataTable.css"

import { ColumnInfos } from "./ValueInspector"
import { valueAsString } from "@/utils"
import { MenuPopover } from "./Popover"
import useWindowDimensions from "../hooks/useWindowDimensions"
import { SortSetting } from "../home-page"
import { Modal } from "./Modal"

export interface SortEvent {
  columnIndex: number
  sortOrder: "asc" | "desc" | "unsorted"
}

export interface TransformerAddedEvent {
  columnIndex: number
  transformerFunctionCode: string
  transformer: Function
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
    React.useState<string>("")

  const handleTransformModalClose = () => {
    setTransformModalOpen(false)
    setTransformerFunctionCode("")
  }

  const handlePopoverClose = () => {
    console.log("handlePopoverClose")
    setPopoverAnchorElement(null)
  }

  // Sticky heaader row adopted from: https://codesandbox.io/s/0mk3qwpl4l?file=/src/index.js
  // See also: https://github.com/bvaughn/react-window?tab=readme-ov-file
  const StickyListContext = createContext([])
  StickyListContext.displayName = "StickyListContext"

  // @ts-ignore
  const ItemWrapper = ({ data, index, style }) => {
    const { ItemRenderer, stickyIndices } = data
    if (stickyIndices && stickyIndices.includes(index)) {
      return null
    }
    return <ItemRenderer index={index} style={style} />
  }

  // @ts-ignore
  const Row = ({ index, style }) => {
    const rowClasses = "flex flex-row" + (index % 2 === 0 ? " bg-gray-100" : "")
    // console.log("row index:", index)
    // console.log("row:", rows[index])
    return (
      <div style={style} className={rowClasses}>
        {rows[index].map((v, vi) => {
          if (hiddenColumns.includes(vi)) {
            return null
          } else {
            const _valueAsString = valueAsString(v)
            let valueCell
            if (_valueAsString) {
              valueCell = _valueAsString
            } else {
              valueCell = <span className="text-gray-500 font-mono">empty</span>
            }
            return (
              <span
                key={vi}
                title={_valueAsString.length > 5 ? _valueAsString : undefined}
                className="p-0.5 text-xs overflow-hidden whitespace-nowrap text-ellipsis"
                style={{
                  width: sColumnWidths[vi],
                }}
                onClick={() => {
                  // TODO: Should show info
                  navigator.clipboard.writeText(_valueAsString)
                }}
              >
                {valueCell}
              </span>
            )
          }
        })}
      </div>
    )
  }

  // @ts-ignore
  const StickyRow = ({ index, style }) => {
    // const buttonRef = React.useRef<HTMLButtonElement>(null)

    const cellRef = React.useRef<Array<HTMLElement | null>>([])
    // you can access the elements with itemsRef.current[n]

    React.useEffect(() => {
      cellRef.current = cellRef.current.slice(0, props.headerRow.length)
    }, [])

    const SortIndicator = ({
      sortOrder,
    }: {
      sortOrder: "asc" | "desc" | null
    }) => {
      if (sortOrder === "asc") {
        return <ArrowUpIconMicro className="size-3 ml-0.5 text-gray-700" />
      } else if (sortOrder === "desc") {
        return <ArrowDownIconMicro className="size-3 ml-0.5 text-gray-700" />
      } else {
        return null
      }
    }

    return (
      <div className="sticky flex flex-row" style={style}>
        {props.headerRow.map((v: string, vi: number) => {
          return props.hiddenColumns.includes(vi) ? null : (
            <div
              key={vi}
              ref={(el) => {
                cellRef.current[vi] = el
              }}
              className="group flex flex-row justify-between p-0.5 bg-gray-200"
              style={{
                width: sColumnWidths[vi],
              }}
              title={v}
            >
              <span
                className="flex flex-row flex-grow cursor-pointer select-none items-center text-xs font-medium overflow-hidden whitespace-nowrap overflow-ellipsis"
                onPointerDown={() => {
                  let newSortOrder: SortEvent["sortOrder"] = "asc"
                  if (props.sortSetting?.columnIndex === vi) {
                    if (props.sortSetting?.sortOrder === "desc") {
                      newSortOrder = "unsorted"
                    } else if (props.sortSetting?.sortOrder === "asc") {
                      newSortOrder = "desc"
                    }
                  }

                  props.onSortingChange({
                    columnIndex: vi,
                    sortOrder: newSortOrder,
                  })
                  setPopoverAnchorElement(null)
                }}
              >
                {v}
                <SortIndicator
                  sortOrder={
                    props.sortSetting?.columnIndex === vi
                      ? props.sortSetting.sortOrder
                      : null
                  }
                />
              </span>

              <button
                className="px-1 text-gray-800 hidden group-hover:block hover:text-black"
                onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => {
                  if (!e.button) {
                    // console.log(e)
                    e.stopPropagation()
                    setPopoverAnchorElement(cellRef.current[vi])
                    setPopoverColumnIndex(vi)
                  }
                }}
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  // @ts-ignore
  const StickyList = ({ children, stickyIndices, ...rest }) => (
    <StickyListContext.Provider
      // @ts-ignore
      value={{ ItemRenderer: children, stickyIndices }}
    >
      {/* @ts-ignore */}
      <FixedSizeList
        itemData={{ ItemRenderer: children, stickyIndices }}
        {...rest}
      >
        {ItemWrapper}
      </FixedSizeList>
    </StickyListContext.Provider>
  )

  // @ts-ignore
  const innerElementType = forwardRef(({ children, ...rest }, ref) => (
    <StickyListContext.Consumer>
      {/* @ts-ignore */}
      {({ stickyIndices }) => (
        // @ts-ignore
        <div ref={ref} {...rest}>
          {stickyIndices.map((index: number) => (
            <StickyRow
              index={index}
              key={index}
              style={{ top: index * 20, left: 0, width: "100%", height: 20 }}
            />
          ))}

          {children}
        </div>
      )}
    </StickyListContext.Consumer>
  ))
  innerElementType.displayName = "ListInner"

  // console.log("Datatable - anchorEl", anchorEl)

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
        },
      },
    ],
  ]

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden border border-gray-300 rounded-md shadow-sm">
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
        open={transformModalOpen}
        onClose={() => {
          handleTransformModalClose()
        }}
      >
        <div>
          <h2 className="m-auto text-2xl text-gray-700">
            Transform Column: {props.headerRow[popoverColumnIndex!]}
          </h2>
          <textarea
            className="w-full"
            value={transformerFunctionCode}
            onChange={(e) => {
              // TODO: Could be debounced
              setTransformerFunctionCode(e.target.value)
            }}
          ></textarea>
          <div className="flex justify-end gap-4">
            <button onPointerDown={() => handleTransformModalClose()}>
              Cancel
            </button>
            <button
              className="font-semibold"
              onPointerDown={() => {
                let transformer = null

                try {
                  transformer = new Function(
                    "value",
                    "columnIndex",
                    "rowIndex",
                    "headerName",
                    "allRows",
                    "originalValue",
                    transformerFunctionCode,
                  )
                } catch (err: any) {
                  console.error(err.toString())
                }

                if (transformer) {
                  props.onTransformerAdded({
                    columnIndex: popoverColumnIndex!,
                    transformerFunctionCode: transformerFunctionCode,
                    transformer,
                  })
                  handleTransformModalClose()
                } else {
                  // TODO: Error handling
                }

                // props.rows.forEach((value, index, allRows) => {
                //   console.log(
                //     transformer(
                //       value[popoverColumnIndex!],
                //       index,
                //       props.headerRow[popoverColumnIndex!],
                //       allRows,
                //     ),
                //   )
                // })
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </Modal>
      {/* TODO: Last line hidden in case of horizontal scrolling */}
      <AutoSizer disableWidth>
        {({ height }) => (
          <StickyList
            className=""
            innerElementType={innerElementType}
            stickyIndices={[0]}
            height={height}
            itemCount={rows.length}
            itemSize={20}
            overscanCount={50}
            width={tableWidth}
          >
            {Row}
          </StickyList>
        )}
      </AutoSizer>
    </div>
  )
}

function estimateColumnWidthPx(valueMaxLength: number): number {
  if (valueMaxLength <= 5) {
    return 64
  } else if (valueMaxLength <= 12) {
    return 128
  } else {
    return 192
  }
}
