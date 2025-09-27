import React, { createContext, forwardRef } from "react"

import { FixedSizeList } from "react-window"

import {
  ArrowUpIcon as ArrowUpIconMicro,
  ArrowDownIcon as ArrowDownIconMicro,
} from "@heroicons/react/16/solid"

import { isLink, valueAsStringFormatted } from "@/utils"
import { SortSetting } from "../../home-page"
import { cva } from "class-variance-authority"
import { cloneDeep } from "lodash-es"

// Sticky heaader row adopted from: https://codesandbox.io/s/0mk3qwpl4l?file=/src/index.js
// See also: https://github.com/bvaughn/react-window?tab=readme-ov-file
const StickyListContext = createContext([])
StickyListContext.displayName = "StickyListContext"

// TODO:Make TS happy one day

// @ts-ignore
const ItemWrapper = ({ data, index, style }) => {
  const {
    ItemRenderer,
    stickyIndices,
    hiddenColumns,
    rows,
    selectedRow,
    headerRow,
    columnsWidths,
    sortSetting,
    isMetaPressed,
    onHeaderPressed,
    onHeaderMenuPressed,
    onValueCellPressed,
    onRowSelected,
  } = data
  if (stickyIndices && stickyIndices.includes(index)) {
    return null
  }
  return (
    <ItemRenderer
      index={index}
      style={style}
      rows={rows}
      selectedRow={selectedRow}
      hiddenColumns={hiddenColumns}
      headerRow={headerRow}
      columnsWidths={columnsWidths}
      isMetaPressed={isMetaPressed}
      sortSetting={sortSetting}
      onHeaderPressed={onHeaderPressed}
      onHeaderMenuPressed={onHeaderMenuPressed}
      onValueCellPressed={onValueCellPressed}
      onRowSelected={onRowSelected}
    />
  )
}

const cellClass = cva(
  "p-0.5 text-xs overflow-hidden whitespace-nowrap text-ellipsis",
  {
    variants: {
      isTypedValue: {
        true: "text-blue-900",
        false: "",
      },
      booleanTrue: {
        true: "text-green-900",
        false: "",
      },
      booleanFalse: {
        true: "text-red-900",
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

export const Row = (
  // @ts-ignore
  // prettier-ignore
  { index, style, rows, selectedRow, headerRow, hiddenColumns, columnsWidths, onValueCellPressed, onRowSelected, isMetaPressed },
) => {
  // const rowClasses = "flex flex-row" + (index % 2 === 0 ? " bg-gray-100" : "")
  // console.log("row index:", index)
  // console.log("row:", rows[index])
  return (
    <div
      // TODO: Regular tab index vs custom highlight of selected row?
      // tabIndex={0}
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
          const booleanTrue = v === true
          const booleanFalse = v === false
          if (_valueAsStringFormatted) {
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
                  isTypedValue: false,
                  booleanTrue,
                  booleanFalse,
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
                  isTypedValue: isTypedValue && typeof v !== "boolean",
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

// @ts-ignore
const StickyRow = ({
  style,
  headerRow,
  hiddenColumns,
  columnsWidths,
  sortSetting,
  onHeaderPressed,
  onHeaderMenuPressed,
}: VirtualizedListProps & { index: number }) => {
  // const buttonRef = React.useRef<HTMLButtonElement>(null)

  const cellRef = React.useRef<Array<HTMLElement | null>>([])
  // you can access the elements with itemsRef.current[n]

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
    <div className="sticky flex flex-row" style={style}>
      {headerRow.map((v: string, vi: number) => {
        return hiddenColumns.includes(vi) ? null : (
          <div
            key={vi}
            data-testid={`header_${vi}_${v}`}
            ref={(el) => {
              cellRef.current[vi] = el
            }}
            className="group flex flex-row justify-between p-0.5 bg-gray-200"
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
                  // console.log(e)
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
          </div>
        )
      })}
    </div>
  )
}

// @ts-ignore
export const innerElementType = forwardRef(({ children, ...rest }, ref) => (
  <StickyListContext.Consumer>
    {/* @ts-ignore */}
    {({
      stickyIndices,
      hiddenColumns,
      headerRow,
      columnsWidths,
      sortSetting,
      onHeaderPressed,
      onHeaderMenuPressed,
    }: VirtualizedListProps) => (
      // @ts-ignore
      <div ref={ref} {...rest}>
        {stickyIndices.map((index: number) => (
          // @ts-ignore
          <StickyRow
            index={index}
            key={index}
            hiddenColumns={hiddenColumns}
            headerRow={headerRow}
            columnsWidths={columnsWidths}
            sortSetting={sortSetting}
            onHeaderPressed={onHeaderPressed}
            onHeaderMenuPressed={onHeaderMenuPressed}
            style={{ top: index * 20, left: 0, width: "100%", height: 20 }}
          />
        ))}
        {children}
      </div>
    )}
  </StickyListContext.Consumer>
))
innerElementType.displayName = "ListInner"

export const StickyList = ({
  // @ts-ignore
  children,
  stickyIndices,
  hiddenColumns,
  rows,
  selectedRow,
  headerRow,
  columnsWidths,
  sortSetting,
  isMetaPressed,
  onHeaderPressed,
  onHeaderMenuPressed,
  onValueCellPressed,
  onRowSelected,
  ...rest
}: VirtualizedListProps) => (
  <StickyListContext.Provider
    value={{
      // @ts-ignore
      ItemRenderer: children,
      stickyIndices,
      hiddenColumns,
      rows,
      selectedRow,
      headerRow,
      columnsWidths,
      sortSetting,
      isMetaPressed,
      onHeaderPressed,
      onHeaderMenuPressed,
      onValueCellPressed,
      onRowSelected,
    }}
  >
    {/* @ts-ignore */}
    <FixedSizeList
      itemData={{
        ItemRenderer: children,
        stickyIndices,
        hiddenColumns,
        rows,
        selectedRow,
        headerRow,
        columnsWidths,
        sortSetting,
        isMetaPressed,
        onHeaderPressed,
        onHeaderMenuPressed,
        onValueCellPressed,
        onRowSelected,
      }}
      {...rest}
    >
      {ItemWrapper}
    </FixedSizeList>
  </StickyListContext.Provider>
)

interface VirtualizedListProps {
  className?: string
  style?: any
  innerElementType: React.ElementType
  stickyIndices: number[]
  height: number
  itemCount: number
  itemSize: number
  overscanCount: number
  width: string
  hiddenColumns: number[]
  rows: any[]
  selectedRow: number | null
  headerRow: string[]
  columnsWidths: string[]
  sortSetting: SortSetting | null
  isMetaPressed: boolean
  onHeaderPressed: ({ columnIndex }: { columnIndex: number }) => void
  onHeaderMenuPressed: ({
    columnIndex,
    headerElement,
  }: {
    columnIndex: number
    headerElement: HTMLElement
  }) => void
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
