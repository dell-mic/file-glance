import { orderBy } from "lodash-es"
import Accordion from "../../components/ui/Accordion"
import React from "react"
import MiddleEllipsis from "../../components/ui/MiddleEllipsis"
import { ColumnFilter, FilterValue, isMacOS } from "@/utils"
import TipsCarousel from "./TipsCarousel/TipsCarousel"
import { MenuPopover } from "../../components/ui/Popover"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline"

type SortField = "name" | "count"
type SortDirection = "asc" | "desc"
interface ColumnSortConfig {
  field: SortField
  direction: SortDirection
}

const CheckmarkIcon = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
  </svg>
)

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
  const isMacOSValue = isMacOS()
  const modKey = isMacOSValue ? "⌘" : "Ctrl"
  const altKey = isMacOSValue ? "⌥" : "Alt"

  const [valuesDisplayed, setValuesDisplayed] = React.useState<number[]>([])
  const [sortConfig, setSortConfig] = React.useState<
    Record<number, ColumnSortConfig> & { default: ColumnSortConfig }
  >({ default: { field: "count", direction: "desc" } })
  const [sortPopoverAnchorEl, setSortPopoverAnchorEl] =
    React.useState<HTMLElement | null>(null)
  const [sortPopoverColumnIndex, setSortPopoverColumnIndex] = React.useState<
    number | null
  >(null)

  // Limit max value inspectors max length to avoid issues when parsing corrupted data leads to large amount of columns
  const MaxColumnsToDisplay = 500

  // Memoized: scanning all distinct values of all columns on every render is too expensive for high-cardinality data
  const isEffectivelyFiltered = React.useMemo(
    () =>
      props.columnValueCounts.some((ci) =>
        ci.columnValues.some(
          (cv) => cv.valueCountTotal !== cv.valueCountFiltered,
        ),
      ),
    [props.columnValueCounts],
  )

  return (
    <div
      className="w-96 flex shrink-0 flex-col gap-2 mb-2 pr-1 overflow-y-auto"
      style={{ scrollbarWidth: "thin" }}
    >
      {props.columnValueCounts.slice(0, MaxColumnsToDisplay).map((column) => (
        <ColumnAccordion
          key={`${column.columnIndex}_${column.columnName}`}
          column={column}
          currentSort={sortConfig[column.columnIndex] || sortConfig.default}
          open={props.openAccordions.includes(column.columnIndex)}
          columnVisible={!props.hiddenColumns.includes(column.columnIndex)}
          onToggleColumnVisibility={() =>
            props.onToggleColumnVisibility(column.columnIndex)
          }
          onToggleAccordion={() => props.onToggleAccordion(column.columnIndex)}
          filters={props.filters}
          onFilterToggle={props.onFilterToggle}
          isEffectivelyFiltered={isEffectivelyFiltered}
          valuesDisplayed={valuesDisplayed[column.columnIndex]}
          onShowAllValues={() =>
            setValuesDisplayed((prev) => {
              const next = [...prev]
              next[column.columnIndex] = Infinity
              return next
            })
          }
          sortPopoverOpen={
            sortPopoverAnchorEl !== null &&
            sortPopoverColumnIndex === column.columnIndex
          }
          sortPopoverAnchorEl={
            sortPopoverColumnIndex === column.columnIndex
              ? sortPopoverAnchorEl
              : null
          }
          onSortPopoverOpen={(el) => {
            setSortPopoverColumnIndex(column.columnIndex)
            setSortPopoverAnchorEl(el)
          }}
          onSortPopoverClose={() => {
            setSortPopoverAnchorEl(null)
            setSortPopoverColumnIndex(null)
          }}
          onSortChange={(field, direction) =>
            setSortConfig((prev) => ({
              ...prev,
              [column.columnIndex]: { field, direction },
            }))
          }
          modKey={modKey}
          altKey={altKey}
        />
      ))}

      <TipsCarousel></TipsCarousel>
    </div>
  )
}

const ColumnAccordion = (props: {
  column: ColumnInfos
  currentSort: ColumnSortConfig
  open: boolean
  columnVisible: boolean
  onToggleColumnVisibility: () => void
  onToggleAccordion: () => void
  filters: ColumnFilter[]
  onFilterToggle: (
    columnIndex: number,
    filterValue: FilterValue,
    isAdding: boolean,
  ) => void
  isEffectivelyFiltered: boolean
  valuesDisplayed: number | undefined
  onShowAllValues: () => void
  sortPopoverOpen: boolean
  sortPopoverAnchorEl: HTMLElement | null
  onSortPopoverOpen: (el: HTMLElement) => void
  onSortPopoverClose: () => void
  onSortChange: (field: SortField, direction: SortDirection) => void
  modKey: string
  altKey: string
}) => {
  const { column, currentSort, open } = props

  const ValuesDisplayedInitially = 50
  const displayedLimit = props.valuesDisplayed || ValuesDisplayedInitially

  // Sorting the full distinct-value list is expensive for high-cardinality columns:
  // memoize it and skip it entirely while the accordion is closed (only the count is shown then)
  const columnValues = React.useMemo(
    () =>
      open
        ? orderBy(
            column.columnValues,
            currentSort.field === "count"
              ? ["valueCountTotal", (cv) => cv.valueName.toLowerCase()]
              : [(cv) => cv.valueName.toLowerCase()],
            currentSort.field === "count"
              ? [currentSort.direction, "asc"]
              : [currentSort.direction],
          )
        : column.columnValues,
    [open, column.columnValues, currentSort],
  )

  return (
    <Accordion
      header={column.columnName}
      subHeader={`${column.columnValues.length.toLocaleString()}`}
      open={open}
      columnVisible={props.columnVisible}
      onToggleColumnVisibility={props.onToggleColumnVisibility}
      onToggleAccordionOpen={props.onToggleAccordion}
      id={`valueInspector_${column.columnIndex}_${column.columnName}`}
    >
      {/* Skip constructing the (up to 50 rows of) children while closed; Accordion only mounts them when open anyway */}
      {open ? (
        <div className="py-1 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 z-10 text-gray-700"
            style={{
              right: "-6px",
              top: "-4px",
            }}
            title="Sort options"
            onPointerDown={(e) => {
              e.stopPropagation()
              props.onSortPopoverOpen(e.currentTarget as HTMLElement)
            }}
          >
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
          </Button>
          <MenuPopover
            open={props.sortPopoverOpen}
            onClose={props.onSortPopoverClose}
            anchorEl={props.sortPopoverAnchorEl}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            menuItems={[
              [
                {
                  text: "Count - High to Low",
                  icon:
                    currentSort.field === "count" &&
                    currentSort.direction === "desc" ? (
                      CheckmarkIcon
                    ) : (
                      <span />
                    ),
                  onSelect: () => props.onSortChange("count", "desc"),
                },
                {
                  text: "Count - Low to High",
                  icon:
                    currentSort.field === "count" &&
                    currentSort.direction === "asc" ? (
                      CheckmarkIcon
                    ) : (
                      <span />
                    ),
                  onSelect: () => props.onSortChange("count", "asc"),
                },
                {
                  text: "Name - A to Z",
                  icon:
                    currentSort.field === "name" &&
                    currentSort.direction === "asc" ? (
                      CheckmarkIcon
                    ) : (
                      <span />
                    ),
                  onSelect: () => props.onSortChange("name", "asc"),
                },
                {
                  text: "Name - Z to A",
                  icon:
                    currentSort.field === "name" &&
                    currentSort.direction === "desc" ? (
                      CheckmarkIcon
                    ) : (
                      <span />
                    ),
                  onSelect: () => props.onSortChange("name", "desc"),
                },
              ],
            ]}
            onSelect={props.onSortPopoverClose}
          />
          <div className="overflow-x-hidden">
            {columnValues.slice(0, displayedLimit).map((columnValue) => {
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

              const displayedValueCounts: string = props.isEffectivelyFiltered
                ? `${columnValue.valueCountFiltered.toLocaleString()} / ${columnValue.valueCountTotal.toLocaleString()}`
                : `${columnValue.valueCountTotal.toLocaleString()}`

              return (
                <div
                  key={`${column.columnIndex}_${columnValue.valueName}`}
                  className="text-sm flex whitespace-nowrap"
                  style={{
                    opacity: columnValue.valueCountFiltered ? 1 : 0.7,
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href="#"
                        className={`text-blue-500 shrink grow-0 overflow-hidden ${
                          columnValue.valueName ? "" : "font-mono"
                        } ${isFilteredValue ? "font-medium" : ""}`}
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
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" sideOffset={4}>
                      <div className="font-medium break-all">
                        {columnValue.valueName || "(empty)"}
                      </div>
                      <div className="border-t border-gray-200 my-2" />
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>
                          <Kbd>Click</Kbd> — filter by this value
                        </div>
                        <div>
                          <Kbd>{props.altKey}-click</Kbd> — exclude this value
                        </div>
                        <div>
                          <Kbd>{props.modKey}-click</Kbd> — add to / remove from
                          current selection
                        </div>
                      </div>
                      <div className="border-t border-gray-200 mt-2 pt-2 text-xs text-gray-500 space-y-1">
                        {props.isEffectivelyFiltered ? (
                          <>
                            <div>
                              <b>
                                {columnValue.valueCountFiltered.toLocaleString()}
                              </b>{" "}
                              / {columnValue.valueCountTotal.toLocaleString()} —
                              rows with this value after active filters / total
                              rows with this value
                            </div>
                            {columnValue.valueCountFiltered === 0 && (
                              <div className="italic">
                                Greyed values have no rows matching the active
                                filters.
                              </div>
                            )}
                          </>
                        ) : (
                          <div>
                            <b>
                              {columnValue.valueCountTotal.toLocaleString()}
                            </b>{" "}
                            — rows containing this value (no filters active)
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-gray-500 ml-2 shrink-0">
                    {displayedValueCounts}
                  </span>
                </div>
              )
            })}

            {column.columnType === "Array" && (
              <div className="text-xs text-gray-500 italic mt-1">
                Note: Values have been flattened for filtering and will use an{" "}
                <span className="font-mono">includes</span> check when selected.
              </div>
            )}

            {columnValues.length > displayedLimit ? (
              <button
                className="w-full hover:bg-gray-100 text-gray-600 text-sm py-2 px-4 rounded-sm"
                onPointerDown={props.onShowAllValues}
              >
                show all {columnValues.length} values
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Accordion>
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
