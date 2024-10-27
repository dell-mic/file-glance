import React, { createContext, forwardRef } from "react"

import { FixedSizeList } from "react-window"

import {
  ArrowUpIcon as ArrowUpIconMicro,
  ArrowDownIcon as ArrowDownIconMicro,
} from "@heroicons/react/16/solid"

import { valueAsString } from "@/utils"
import { SortSetting } from "../home-page"

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
    headerRow,
    columnsWidths,
    sortSetting,
    onHeaderPressed,
    onHeaderMenuPressed,
    onValueCellPressed,
  } = data
  if (stickyIndices && stickyIndices.includes(index)) {
    return null
  }
  return (
    <ItemRenderer
      index={index}
      style={style}
      rows={rows}
      hiddenColumns={hiddenColumns}
      headerRow={headerRow}
      columnsWidths={columnsWidths}
      sortSetting={sortSetting}
      onHeaderPressed={onHeaderPressed}
      onHeaderMenuPressed={onHeaderMenuPressed}
      onValueCellPressed={onValueCellPressed}
    />
  )
}

export const Row = (
  // @ts-ignore
  { index, style, rows, hiddenColumns, columnsWidths, onValueCellPressed },
) => {
  const rowClasses = "flex flex-row" + (index % 2 === 0 ? " bg-gray-100" : "")
  // console.log("row index:", index)
  // console.log("row:", rows[index])
  return (
    <div style={style} className={rowClasses}>
      {rows[index].map((v: any, vi: number) => {
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
                width: columnsWidths[vi],
              }}
              onClick={() => {
                onValueCellPressed({ value: v, valueAsString: _valueAsString })
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
              className="flex flex-row flex-grow cursor-pointer select-none items-center text-xs font-medium overflow-hidden whitespace-nowrap overflow-ellipsis"
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
  headerRow,
  columnsWidths,
  sortSetting,
  onHeaderPressed,
  onHeaderMenuPressed,
  onValueCellPressed,
  ...rest
}: VirtualizedListProps) => (
  <StickyListContext.Provider
    value={{
      // @ts-ignore
      ItemRenderer: children,
      stickyIndices,
      hiddenColumns,
      rows,
      headerRow,
      columnsWidths,
      sortSetting,
      onHeaderPressed,
      onHeaderMenuPressed,
      onValueCellPressed,
    }}
  >
    {/* @ts-ignore */}
    <FixedSizeList
      itemData={{
        ItemRenderer: children,
        stickyIndices,
        hiddenColumns,
        rows,
        headerRow,
        columnsWidths,
        sortSetting,
        onHeaderPressed,
        onHeaderMenuPressed,
        onValueCellPressed,
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
  headerRow: string[]
  columnsWidths: string[]
  sortSetting: SortSetting | null
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
}
