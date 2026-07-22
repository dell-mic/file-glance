import React from "react"

import type { RowComponentProps } from "react-window"

import {
  ArrowUpIcon as ArrowUpIconMicro,
  ArrowDownIcon as ArrowDownIconMicro,
} from "@heroicons/react/16/solid"

import {
  isEmptyArray,
  isLink,
  isNonEmptyArray,
  valueAsStringFormatted,
  SortSetting,
} from "@/utils"
import { cva } from "class-variance-authority"
import { cloneDeep } from "lodash-es"

// See: https://github.com/bvaughn/react-window

export interface RowProps {
  stickyIndices: number[]
  hiddenColumns: number[]
  rows: any[]
  selectedRow: number | null
  headerRow: string[]
  columnsWidths: number[]
  sortSetting: SortSetting | null
  isMetaPressed: boolean
  onValueCellPressed: ({
    value,
    valueAsString,
  }: {
    value: any
    valueAsString: string
  }) => void
  onRowSelected: ({
    rowIndex,
    rowData,
  }: {
    rowIndex: number
    rowData: any[]
  }) => void
}

export interface StickyRowProps {
  headerRow: string[]
  hiddenColumns: number[]
  columnsWidths: number[]
  sortSetting: SortSetting | null
  onHeaderPressed: ({ columnIndex }: { columnIndex: number }) => void
  onHeaderMenuPressed: ({
    columnIndex,
    headerElement,
  }: {
    columnIndex: number
    headerElement: HTMLElement
  }) => void
  onColumnResize: ({
    columnIndex,
    width,
  }: {
    columnIndex: number
    width: number
  }) => void
  onColumnResizeDoubleClick: ({
    columnIndex,
    headerFont,
  }: {
    columnIndex: number
    headerFont: string
  }) => void
}

const cellClass = cva(
  "p-0.5 text-xs overflow-hidden whitespace-nowrap text-ellipsis",
  {
    variants: {
      isNumber: {
        true: "text-blue-900",
        false: "",
      },
      isBigInt: {
        true: "text-indigo-900",
        false: "",
      },
      booleanTrue: {
        true: "text-green-800",
        false: "",
      },
      booleanFalse: {
        true: "text-red-900",
        false: "",
      },
      isArray: {
        true: "text-purple-950",
        false: "",
      },
      isDate: {
        true: "text-cyan-900",
        false: "",
      },
      isEmpty: {
        true: "text-gray-500 font-mono",
        false: "",
      },
      isMetaPressed: {
        true: "hover:underline cursor-pointer",
        false: "",
      },
      isLink: {
        true: "hover:text-blue-600 ",
        false: "",
      },
    },
  },
)

const rowClasses = cva("flex flex-row", {
  variants: {
    isOdd: {
      true: "bg-gray-100",
      false: "",
    },
  },
})

export const Row = ({
  index,
  style,
  stickyIndices,
  rows,
  selectedRow,
  headerRow,
  hiddenColumns,
  columnsWidths,
  isMetaPressed,
  onValueCellPressed,
  onRowSelected,
}: RowComponentProps<RowProps>) => {
  if (stickyIndices.includes(index)) {
    return null
  }

  return (
    <div
      className={rowClasses({
        isOdd: index % 2 === 0,
      })}
      style={{
        ...style,
        outline:
          index === selectedRow
            ? "1px dotted var(--color-blue-900)"
            : undefined,
        outlineOffset: index === selectedRow ? "-1px" : undefined,
      }}
    >
      {headerRow.map((header: any, vi: number) => {
        const v = rows[index][vi]
        if (hiddenColumns.includes(vi)) {
          return null
        } else {
          const _valueAsStringFormatted = valueAsStringFormatted(v)
          const _valueAsStringRow = "" + v
          let isEmpty = false
          let valueCell

          const isTypedValue = typeof v !== "string"

          let isNumber = false
          let isBigInt = false
          let isDate = false
          let isArray = false
          let booleanTrue = false
          let booleanFalse = false

          if (isTypedValue) {
            if (typeof v === "number") {
              isNumber = true
            } else if (v === true) {
              booleanTrue = true
            } else if (v === false) {
              booleanFalse = true
            } else if (v instanceof Date) {
              isDate = true
            } else if (isNonEmptyArray(v)) {
              isArray = true
            } else if (typeof v === "bigint") {
              isBigInt = true
            }
          }

          if (_valueAsStringFormatted || isArray) {
            valueCell = _valueAsStringFormatted
          } else {
            valueCell = "empty"
            isEmpty = true
          }
          let title = ""

          if (!isEmpty) {
            title = isTypedValue
              ? `${_valueAsStringRow} [${v.constructor.name}]`
              : _valueAsStringRow
          } else if (isEmptyArray(v)) {
            title = `${JSON.stringify(v)} [${v.constructor.name}]`
          } else if (_valueAsStringRow === "") {
            title = "(empty string)"
          } else {
            title = _valueAsStringRow
          }

          title += "\n\nColumn: " + header

          const highlightLinks = isMetaPressed && isLink(v)

          if (highlightLinks) {
            // Use actual links for link highlight such that e.g. "copy link" context menu features work out of the box
            return (
              <a
                key={vi}
                title={title}
                className={cellClass({
                  isNumber: false,
                  booleanTrue,
                  booleanFalse,
                  isArray,
                  isEmpty,
                  isMetaPressed,
                  isLink: true,
                })}
                style={{
                  width: columnsWidths[vi],
                }}
                href={valueCell}
                target="_blank"
              >
                {valueCell}
              </a>
            )
          } else {
            return (
              <span
                key={vi}
                title={title}
                className={cellClass({
                  isNumber,
                  isBigInt,
                  isArray,
                  isDate,
                  booleanTrue,
                  booleanFalse,
                  isEmpty,
                  isMetaPressed,
                })}
                style={{
                  width: columnsWidths[vi],
                }}
                onClick={() => {
                  if (isMetaPressed) {
                    onValueCellPressed({
                      value: v,
                      valueAsString: _valueAsStringFormatted,
                    })
                  } else {
                    onRowSelected({
                      rowIndex: index,
                      rowData: cloneDeep(rows[index]),
                    })
                  }
                }}
              >
                {valueCell}
              </span>
            )
          }
        }
      })}
    </div>
  )
}

export const StickyRow = ({
  headerRow,
  hiddenColumns,
  columnsWidths,
  sortSetting,
  onHeaderPressed,
  onHeaderMenuPressed,
  onColumnResize,
  onColumnResizeDoubleClick,
}: StickyRowProps) => {
  const cellRef = React.useRef<Array<HTMLElement | null>>([])
  const resizeDragRef = React.useRef<{
    pointerId: number
    columnIndex: number
    startX: number
    startWidth: number
  } | null>(null)

  React.useEffect(() => {
    cellRef.current = cellRef.current.slice(0, headerRow.length)
  }, [headerRow])

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
    <div
      className="sticky flex flex-row"
      style={{ top: 0, left: 0, width: "100%", height: 20 }}
    >
      {headerRow.map((v: string, vi: number) => {
        return hiddenColumns.includes(vi) ? null : (
          <div
            key={vi}
            data-testid={`header_${vi}_${v}`}
            ref={(el) => {
              cellRef.current[vi] = el
            }}
            className="group relative flex flex-row justify-between p-0.5 bg-gray-200"
            style={{
              width: columnsWidths[vi],
            }}
            title={v}
          >
            <span
              className="flex flex-row grow cursor-pointer select-none items-center text-xs font-medium overflow-hidden whitespace-nowrap text-ellipsis"
              onPointerDown={() => {
                onHeaderPressed({
                  columnIndex: vi,
                })
              }}
            >
              {v}
              <SortIndicator
                sortOrder={
                  sortSetting?.columnIndex === vi ? sortSetting.sortOrder : null
                }
              />
            </span>

            <button
              data-testid={`headerBtn_${vi}_${v}`}
              className="px-1 text-gray-800 hidden group-hover:block hover:text-black"
              onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => {
                if (!e.button) {
                  e.stopPropagation()
                  onHeaderMenuPressed({
                    columnIndex: vi,
                    headerElement: cellRef.current[vi]!,
                  })
                }
              }}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
              </svg>
            </button>

            <div
              data-testid={`headerResize_${vi}_${v}`}
              className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none opacity-0 group-hover:opacity-100 hover:bg-blue-400"
              title="Drag to resize column; double-click to fit content / reset"
              onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
                if (e.button !== 0) return
                e.stopPropagation()
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                resizeDragRef.current = {
                  pointerId: e.pointerId,
                  columnIndex: vi,
                  startX: e.clientX,
                  startWidth: columnsWidths[vi],
                }
              }}
              onPointerMove={(e: React.PointerEvent<HTMLDivElement>) => {
                const drag = resizeDragRef.current
                if (!drag || drag.pointerId !== e.pointerId) return
                e.stopPropagation()
                onColumnResize({
                  columnIndex: drag.columnIndex,
                  width: drag.startWidth + e.clientX - drag.startX,
                })
              }}
              onPointerUp={(e: React.PointerEvent<HTMLDivElement>) => {
                if (resizeDragRef.current?.pointerId === e.pointerId) {
                  e.stopPropagation()
                  resizeDragRef.current = null
                }
              }}
              onPointerCancel={() => {
                resizeDragRef.current = null
              }}
              onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => {
                e.stopPropagation()
                onColumnResizeDoubleClick({
                  columnIndex: vi,
                  headerFont: window.getComputedStyle(cellRef.current[vi]!)
                    .font,
                })
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
