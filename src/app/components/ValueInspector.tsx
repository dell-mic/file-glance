import { orderBy } from "lodash"
import Accordion from "./Accordion"
import { ColumnFilter } from "../home-page"

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
  // TODO: Implemment 'Display all' logic
  const maxValuesDisplayed = 5000

  return (
    <div className="w-96 flex flex-shrink-0 flex-col gap-2 mb-2 pr-1 overflow-y-auto">
      {props.columnValueCounts.map((column) => {
        const columnValues = orderBy(
          column.columnValues,
          ["valueCount", "valueName"],
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
          >
            <div className="py-1">
              {columnValues.slice(0, maxValuesDisplayed).map((columnValue) => {
                const existingColFilter = props.filters.find(
                  (_) => _.columnIndex === column.columnIndex,
                )

                const isFilteredValue =
                  existingColFilter &&
                  existingColFilter.includedValues.some(
                    (fValue) => fValue === columnValue.valueName,
                  )

                return (
                  <div
                    key={`${column.columnIndex}_${columnValue.valueName}`}
                    className="text-sm"
                  >
                    <a
                      href="#"
                      className={`text-blue-500 ${
                        columnValue.valueName ? "" : "font-mono"
                      } ${isFilteredValue ? "font-bold" : ""}`}
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
                      {columnValue.valueName || "empty"}
                    </a>
                    <span className="text-gray-500">{` ${columnValue.valueCount}`}</span>
                  </div>
                )
              })}
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
  valueName: string
  valueCount: number
}
