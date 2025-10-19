import { orderBy } from "lodash-es"
import Accordion from "../../components/ui/Accordion"
import React from "react"
import MiddleEllipsis from "../../components/ui/MiddleEllipsis"
import { ColumnFilter, FilterValue } from "@/utils"

export const ValuesInspector = (props: {
  filters: ColumnFilter[]
  onFilterToggle: (
    columnIndex: number,
    filterValue: FilterValue,
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

  const isEffectivelyFiltered = props.columnValueCounts.some((ci) =>
    ci.columnValues.some((cv) => cv.valueCountTotal !== cv.valueCountFiltered),
  )

  // Limit max value inspectors max length to avoid issues when parsing corrupted data leads to large amount of columns
  const MaxColumnsToDisplay = 500

  return (
    <div
      className="w-96 flex shrink-0 flex-col gap-2 mb-2 pr-1 overflow-y-auto"
      style={{ scrollbarWidth: "thin" }}
    >
      {props.columnValueCounts.slice(0, MaxColumnsToDisplay).map((column) => {
        const columnValues = orderBy(
          column.columnValues,
          ["valueCountTotal", "valueName"],
          ["desc", "asc"],
        )
        return (
          <Accordion
            header={column.columnName}
            subHeader={`${columnValues.length.toLocaleString()}`}
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

                  const existingFilterForValue =
                    existingColFilter &&
                    existingColFilter.filterValues.find(
                      (fValue) => fValue.value === columnValue.valueName,
                    )
                  const isFilteredValue = !!existingFilterForValue

                  const isExcludeFilter =
                    isFilteredValue && !existingFilterForValue.included

                  const displayedValueCounts: string = isEffectivelyFiltered
                    ? `${columnValue.valueCountFiltered.toLocaleString()}\u2009/\u2009${columnValue.valueCountTotal.toLocaleString()}`
                    : `${columnValue.valueCountTotal.toLocaleString()}`

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
                        className={`text-blue-500 shrink grow-0 overflow-hidden ${
                          columnValue.valueName ? "" : "font-mono"
                        } ${isFilteredValue ? "font-medium" : ""}`}
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
                            {
                              value: columnValue.valueName,
                              included: !e.altKey,
                            },
                            e.metaKey,
                          )
                        }}
                      >
                        <MiddleEllipsis>
                          {isExcludeFilter && (
                            <span
                              className="mr-0.5 text-red-700"
                              style={{ fontWeight: "bold" }}
                            >
                              ¬
                            </span>
                          )}
                          <span>{columnValue.valueName || "empty"}</span>
                        </MiddleEllipsis>
                      </a>
                      <span className="text-gray-500 ml-2 shrink-0">
                        {displayedValueCounts}
                      </span>
                    </div>
                  )
                })}

              {column.columnType === "Array" && (
                <div className="text-xs text-gray-500 italic mt-1">
                  Note: Values have been flattened for filtering and will use an{" "}
                  <span className="font-mono">includes</span> check when
                  selected.
                </div>
              )}

              {columnValues.length >
              (valuesDisplayed[column.columnIndex] ||
                ValuesDisplayedInitially) ? (
                <button
                  className="w-full hover:bg-gray-100 text-gray-600 text-sm py-2 px-4 rounded-sm"
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
  columnType: string // Return value of: constructor.name (if same for all columns values)
}

export interface ColumnValues {
  value: any
  originalValue: any
  valueName: string
  valueCountTotal: number
  valueCountFiltered: number
}
