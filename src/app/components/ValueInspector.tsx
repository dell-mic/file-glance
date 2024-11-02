import { orderBy } from "lodash"
import Accordion from "./Accordion"
import { ColumnFilter } from "../home-page"
import React from "react"
import MiddleEllipsis from "./MiddleEllipsis"

export const ValuesInspector = (props: {
  filters: ColumnFilter[]
  onFilterToggle: (
    columnIndex: number,
    valueName: string,
    isAdding: boolean,
  ) => void
  columnValueCounts: ColumnInfos[]
  openAccordions: number[]
  onToggleAccordion: (index: number) => void
  hiddenColumns: number[]
  onToggleColumnVisibility: (index: number) => void
}) => {
  const [valuesDisplayed, setValuesDisplayed] = React.useState<number[]>([])

  const ValuesDisplayedInitially = 50

  const isEffectivlyFiltered = props.columnValueCounts.some((ci) =>
    ci.columnValues.some((cv) => cv.valueCountTotal !== cv.valueCountFiltered),
  )

  return (
    <div className="w-96 flex flex-shrink-0 flex-col gap-2 mb-2 pr-1 overflow-y-auto">
      {props.columnValueCounts.map((column) => {
        const columnValues = orderBy(
          column.columnValues,
          ["valueCountTotal", "valueName"],
          ["desc", "asc"],
        )
        return (
          <Accordion
            header={column.columnName}
            subHeader={`${columnValues.length}`}
            open={props.openAccordions.includes(column.columnIndex)}
            columnVisible={!props.hiddenColumns.includes(column.columnIndex)}
            onToggleColumnVisibility={props.onToggleColumnVisibility.bind(
              this,
              column.columnIndex,
            )}
            onToggleAccordionOpen={props.onToggleAccordion.bind(
              this,
              column.columnIndex,
            )}
            key={`${column.columnIndex}_${column.columnName}`}
            id={`valueInspector_${column.columnIndex}_${column.columnName}`}
          >
            <div className="py-1 overflow-x-hidden">
              {columnValues
                .slice(
                  0,
                  valuesDisplayed[column.columnIndex] ||
                    ValuesDisplayedInitially,
                )
                .map((columnValue) => {
                  const existingColFilter = props.filters.find(
                    (_) => _.columnIndex === column.columnIndex,
                  )

                  const isFilteredValue =
                    existingColFilter &&
                    existingColFilter.includedValues.some(
                      (fValue) => fValue === columnValue.valueName,
                    )

                  const displayedValueCounts = isEffectivlyFiltered
                    ? `${columnValue.valueCountFiltered}\u2009/\u2009${columnValue.valueCountTotal}`
                    : `${columnValue.valueCountTotal}`

                  return (
                    <div
                      key={`${column.columnIndex}_${columnValue.valueName}`}
                      className="text-sm flex whitespace-nowrap"
                      style={{
                        opacity: columnValue.valueCountFiltered ? 1 : 0.7,
                      }}
                    >
                      <a
                        href="#"
                        className={`text-blue-500 shrink grow-0 overflow-hidden${
                          columnValue.valueName ? "" : "font-mono"
                        } ${isFilteredValue ? "font-bold" : ""}`}
                        title={columnValue.valueName}
                        onClick={(e) => e.preventDefault()}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          // Do not react to secondary buttons (>0)
                          if (e.button) {
                            return
                          }
                          props.onFilterToggle(
                            column.columnIndex,
                            columnValue.valueName,
                            e.metaKey,
                          )
                        }}
                      >
                        <MiddleEllipsis>
                          <span>{columnValue.valueName || "empty"}</span>
                        </MiddleEllipsis>
                      </a>
                      <span className="text-gray-500 ml-2 shrink-0">
                        {displayedValueCounts}
                      </span>
                    </div>
                  )
                })}
              {columnValues.length >
              (valuesDisplayed[column.columnIndex] ||
                ValuesDisplayedInitially) ? (
                <button
                  className="w-full hover:bg-gray-100 text-gray-600 text-sm py-2 px-4 rounded"
                  onPointerDown={() => {
                    const updatedValuesDisplayed = [...valuesDisplayed]
                    updatedValuesDisplayed[column.columnIndex] = Infinity
                    setValuesDisplayed(updatedValuesDisplayed)
                  }}
                >
                  show all {columnValues.length} values
                </button>
              ) : null}
            </div>
          </Accordion>
        )
      })}
    </div>
  )
}

export interface ColumnInfos {
  columnName: string
  columnIndex: number
  columnValues: ColumnValues[]
  valuesMaxLength: number
  isEmptyColumn: boolean
}

export interface ColumnValues {
  value: any
  valueName: string
  valueCountTotal: number
  valueCountFiltered: number
}
