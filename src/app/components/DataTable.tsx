import { sum } from "lodash"
import React, { createContext, forwardRef } from "react"
import { FixedSizeList } from "react-window"
import AutoSizer from "react-virtualized-auto-sizer"

import "./DataTable.css"

import { ColumnInfos } from "./ValueInspector"
import { valueAsString } from "@/utils"
import { Popover } from "./Popover"
import useWindowDimensions from "../hooks/useWindowDimensions"

export const DataTable = (props: {
  headerRow: string[]
  rows: Array<Array<any>>
  columnValueCounts: ColumnInfos[]
  hiddenColumns: number[],
  onSortingChange: (
    columnIndex: number,
    sortOrder: string
  ) => void
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
  const MaxGrowthFactor = 2
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
  // const [popoverCoordinates, setPopoverCoordinates] = React.useState<any>({
  //   top: 0,
  //   left: 0,
  // })

  const handlePopoverClose = () => {
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
                className=" text-xs font-medium overflow-hidden whitespace-nowrap overflow-ellipsis"
                onClick={() => {
                  // TODO: Should show info
                  navigator.clipboard.writeText(v)
                }}
              >
                {v}
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

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden border border-gray-300 rounded-md shadow-sm">
      <Popover
        id={"columnPopover"}
        open={Boolean(popoverAnchorElement)}
        anchorEl={popoverAnchorElement}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
      >
        <div className="flex flex-col py-2 px-1">
          <button
            onPointerDown={() => console.log("sort asc", popoverColumnIndex)}
          >
            Sort ascending
          </button>
          <button
            onPointerDown={() => console.log("sort desc", popoverColumnIndex)}
          >
            Sort descending
          </button>
        </div>
      </Popover>
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
  if (valueMaxLength <= 4) {
    return 64
  } else if (valueMaxLength <= 10) {
    return 128
  } else {
    return 192
  }
}
