import { sum } from "lodash"
import React, { createContext, forwardRef, CSSProperties } from "react"
import { FixedSizeList } from "react-window"
import AutoSizer from "react-virtualized-auto-sizer"

import "./DataTable.css"

import { ColumnInfos } from "./ValueInspector"

export const DataTable = (props: {
  headerRow: string[]
  rows: Array<Array<any>>
  columnValueCounts: ColumnInfos[]
  hiddenColumns: number[]
}) => {
  // console.log(rows)
  const rows = [props.headerRow, ...props.rows]
  const hiddenColumns = props.hiddenColumns

  const columnWidths = props.columnValueCounts.map((cvc) =>
    !hiddenColumns.includes(cvc.columnIndex)
      ? estimateColumnWidthPx(cvc.valuesMaxLength)
      : 0,
  )
  const tableWidth = `${sum(columnWidths)}px`
  const sColumnWidths = columnWidths.map((cw) => `${cw}px`)

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
    // console.log("row index:", index)
    // console.log("row:", rows[index])
    return (
      <div
        style={style}
        className="flex flex-row even:bg-gray-100 odd:bg-white"
      >
        {rows[index].map((v, vi) => {
          if (hiddenColumns.includes(vi)) {
            return null
          } else {
            // Convert false,0 to string
            const valueAsString = "" + v
            let valueCell
            if (v) {
              valueCell = valueAsString
            } else {
              if (v === "" || v === null || v === undefined) {
                valueCell = (
                  <span className="text-gray-500 font-mono">empty</span>
                )
              } else {
                valueCell = valueAsString
              }
            }
            return (
              <span
                key={vi}
                title={valueAsString.length > 5 ? valueAsString : undefined}
                className="p-0.5 text-xs overflow-hidden whitespace-nowrap text-ellipsis"
                style={{
                  width: sColumnWidths[vi],
                }}
                onClick={() => {
                  // TODO: Should show info
                  navigator.clipboard.writeText(valueAsString)
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
  const StickyRow = ({ index, style }) => (
    <div className="sticky flex flex-row" style={style}>
      {props.headerRow.map((v: string, vi: number) => {
        return props.hiddenColumns.includes(vi) ? null : (
          <span
            key={vi}
            className="p-0.5 text-xs font-medium overflow-hidden whitespace-nowrap overflow-ellipsis bg-gray-200"
            style={{
              width: sColumnWidths[vi],
            }}
            title={v}
            onClick={() => {
              // TODO: Should show info
              navigator.clipboard.writeText(v)
            }}
          >
            {v}
          </span>
        )
      })}
    </div>
  )

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

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden border border-gray-300 rounded-md shadow-sm">
      {/* TODO: Last line not rendered! */}
      <AutoSizer disableWidth>
        {({ height }) => (
          <StickyList
            className=""
            innerElementType={innerElementType}
            stickyIndices={[0]}
            height={height}
            itemCount={rows.length}
            itemSize={20}
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
  if (valueMaxLength <= 4) {
    return 64
  } else if (valueMaxLength <= 10) {
    return 128
  } else {
    return 192
  }
}
