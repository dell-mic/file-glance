"use client"

import React from "react"

import { cloneDeep, maxBy, orderBy } from "lodash"

import * as XLSX from "xlsx"
import { parse } from "csv-parse/browser/esm/sync"
import { stringify as stringifyCSV } from "csv-stringify/browser/esm/sync"
import { ColumnInfos, ValuesInspector } from "./components/ValueInspector"
import { DataTable } from "./components/DataTable"
import { FileChooser } from "./components/FileChooser"
import { Modal } from "./components/Modal"
import {
  generateSampleData,
  hasHeader,
  jsonToTable,
  readFileToString,
  saveFile,
  tableToJson,
  tryParseJSONObject,
  valueAsString,
} from "@/utils"
import { title } from "@/constants"
import { ArchiveBoxArrowDownIcon } from "@heroicons/react/24/outline"
import { ArchiveBoxArrowDownIcon as ArchiveBoxArrowDownIconSolid } from "@heroicons/react/24/solid"
import { MenuPopover } from "./components/Popover"

export interface SortSetting {
  columnIndex: number
  sortOrder: "asc" | "desc"
}

export interface Transformer {
  columnIndex: number
  transformerFunctionCode: string
  transformer: Function
}

export default function Home() {
  const [dragging, setDragging] = React.useState(false)
  const [currentFile, setCurrentFile] = React.useState<File | null>(null)

  const [openAccordions, setOpenAccordions] = React.useState<number[]>([])
  const [hiddenColumns, setHiddenColumns] = React.useState<number[]>([])
  // const [columnValueCounts, setColumnValueCounts] = React.useState<
  //   ColumnInfos[]
  // >([])
  const [popoverAnchorElement, setPopoverAnchorElement] =
    React.useState<HTMLElement | null>(null)
  const exportButtonRef = React.useRef(null)

  const [headerRow, setHeaderRow] = React.useState<Array<string>>([])
  const [allRows, setAllRows] = React.useState<any[][]>([])
  const [filters, setFilters] = React.useState<Array<ColumnFilter>>([])
  const [transformers, setTransformers] = React.useState<Array<Transformer>>([])
  const [search, setSearch] = React.useState<string>("")
  const [sortSetting, setSortSetting] = React.useState<SortSetting | null>(null)
  // const [columnValueCounts, setcColumnValueCounts] = React.useState<
  //   ColumnInfos[]
  // >([]);

  const handlePopoverClose = () => {
    setPopoverAnchorElement(null)
  }

  const drop = React.useRef(null)

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const parseFile = async (file: File) => {
    console.time("parseFile")
    setData(file, [], [])
    let data: any[][] = []
    let _headerRow: string[] = []
    let isHeaderSet = false
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      const fileAsArrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(fileAsArrayBuffer)
      // console.log("workbook.SheetNames", workbook.SheetNames)
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      // console.log("firstSheet", firstSheet)
      data = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        blankrows: false,
        defval: "",
      })
    } else if (file.name.toLowerCase().endsWith(".json")) {
      const contentAsText: string = await readFileToString(file)

      const parsedContent: any = JSON.parse(contentAsText)

      const arrayData = findArray(parsedContent)

      if (arrayData) {
        const jsonAsTable = jsonToTable(arrayData)
        data = jsonAsTable.data
        _headerRow = jsonAsTable.headerRow
        isHeaderSet = true
      } else {
        data = []
        _headerRow = []
        // TODO: Better error handling
        console.error("No array in JSON found")
      }
    } else {
      // Somehow-Separated text
      const contentAsText: string = await readFileToString(file)
      const delimiter = detectDelimiter(contentAsText)
      if (delimiter) {
        data = parse(contentAsText, {
          delimiter,
          bom: true,
          skip_empty_lines: true,
          relax_column_count: true,
        })
      }
      // console.log(data)
    }

    if (data.length) {
      const longestRowLength = maxBy(data, (d) => d.length)!.length
      if (!isHeaderSet) {
        const headerDetected = hasHeader(data)
        console.log("headerDetected", headerDetected)
        // header row detection and synthetic generation if not present
        if (headerDetected) {
          _headerRow = data.shift()!
        } else {
          _headerRow = Array.from(Array(longestRowLength).keys()).map(
            (i) => "col_" + `${i + 1}`.padStart(2, "0"),
          )
        }
      }

      // Fill shorter rows with null values if needed
      for (const row of data) {
        if (row.length < longestRowLength) {
          row.push(...Array(longestRowLength - row.length).fill(null))
        }
      }

      setData(file, _headerRow, data)
    } else {
      // TODO: Better error handling
      console.error("ERROR while parsing data")
      setData(null, [], [])
    }
    console.timeEnd("parseFile")
  }

  const parseText = (text: string) => {
    // detect if text looks like proper json
    const isJson = tryParseJSONObject(text) !== false
    // TODO: A bit hacky and inefficient, but easy way to re-use existing parseFile method
    const blob = new Blob([text], { type: "text/plain" })
    let syntheticFileName = "CLIPBOARD"
    if (isJson) {
      syntheticFileName += ".json"
    }
    const syntheticFile = new File([blob], syntheticFileName, {
      lastModified: new Date().getTime(),
    })
    parseFile(syntheticFile)
  }

  const onGenerateSampleData = () => {
    const rowsAmount = 1337
    const simulatedFileBytes = Array.from(
      { length: rowsAmount * 50 },
      () => "1",
    )
    const sampleData = generateSampleData(rowsAmount)
    setData(
      new File(simulatedFileBytes, "Generated-Sample.csv", {
        lastModified: new Date().getTime(),
      }),
      sampleData.headerRow,
      jsonToTable(sampleData.data).data,
    )
  }

  const setData = (
    file: File | null,
    headerRow: string[],
    data: string[][],
  ) => {
    if (!file) {
      document.title = title
      setCurrentFile(null)
      setHeaderRow([])
      setAllRows([])
      return
    }
    document.title = file.name
    setCurrentFile(file)
    setHeaderRow(headerRow)
    setAllRows(data)

    // TODO: More efficient way to find empty columns?
    const _columnValueCounts = countValues(headerRow, data)

    // Hide empty columns initially
    setHiddenColumns(
      _columnValueCounts
        .filter((cvc) => cvc.isEmptyColumn)
        .map((cvc) => cvc.columnIndex),
    )
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setDragging(false)

    const files = e.dataTransfer ? [...e.dataTransfer.files] : []

    console.log("dropped files:", files)
    if (files.length) {
      const firstFile = files[0]
      parseFile(firstFile)
    }
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || [])
    console.log("selected files:", files)

    e.preventDefault()
    e.stopPropagation()

    if (files.length) {
      const firstFile = files[0]
      parseFile(firstFile)
    }
  }

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // console.log("handleDragEnter", e);
    setDragging(true)
  }

  // const handleDragLeave = (e: DragEvent) => {
  //   e.preventDefault()
  //   e.stopPropagation()
  //   // console.log("handleDragLeave", e);
  //   // setDragging(false)
  // }

  const handleWindowMouseOut = (e: MouseEvent) => {
    // As we bascially allow dropping in the whole window only set to false when leaving the window
    setDragging(false)
  }

  React.useEffect(() => {
    // @ts-ignore
    drop.current.addEventListener("dragover", handleDragOver)
    // @ts-ignore
    drop.current.addEventListener("drop", handleDrop)
    // @ts-ignore
    drop.current.addEventListener("dragenter", handleDragEnter)
    // @ts-ignore
    // drop.current.addEventListener("dragleave", handleDragLeave)

    return () => {
      // @ts-ignore
      drop.current.removeEventListener("dragover", handleDragOver)
      // @ts-ignore
      drop.current.removeEventListener("drop", handleDrop)
      // @ts-ignore
      drop.current.removeEventListener("dragenter", handleDragEnter)
      // @ts-ignore
      // drop.current.removeEventListener("dragleave", handleDragLeave)
    }
  }, [])

  React.useEffect(() => {
    window.addEventListener("mouseout", handleWindowMouseOut)

    return () => {
      window.removeEventListener("mouseout", handleWindowMouseOut)
    }
  }, [])

  // console.log("dragging", dragging)

  const onFilterToggle = (
    columnIndex: number,
    valueName: string,
    isAdding: boolean,
  ) => {
    let newColFilter: ColumnFilter
    const existingColFilter = filters.find((_) => _.columnIndex === columnIndex)
    // Easy case: No filter for this column so far => Simply add with clicked value
    if (!existingColFilter) {
      newColFilter = {
        columnIndex: columnIndex,
        includedValues: [valueName],
      }
    } else {
      if (isAdding) {
        // With meta key pressed allow selecting of several values
        newColFilter = {
          columnIndex: columnIndex,
          includedValues: addOrRemove(
            existingColFilter.includedValues,
            valueName,
          ),
        }
      } else {
        // Deslect already selected / replace
        newColFilter = {
          columnIndex: columnIndex,
          includedValues: existingColFilter.includedValues.includes(valueName)
            ? existingColFilter.includedValues.filter((iv) => iv !== valueName)
            : [valueName],
        }
      }
    }
    const updatedFilters = [
      ...filters.filter((_) => _.columnIndex !== columnIndex),
      newColFilter,
    ].filter((f) => f.includedValues.length)
    setFilters(updatedFilters)
  }

  // Apply transformers
  let displayedData: any[][] = cloneDeep(allRows)
  console.time("applyTransfomer")
  console.log("transformers", transformers)
  if (transformers.length) {
    for (const [rowIndex, row] of displayedData.entries()) {
      for (const columnIndex of row.keys()) {
        for (const transformer of transformers) {
          if (transformer.columnIndex === columnIndex) {
            try {
              row[columnIndex] = transformer.transformer(
                row[columnIndex],
                columnIndex,
                rowIndex,
                headerRow[columnIndex],
                displayedData,
                allRows[rowIndex][columnIndex],
              )
            } catch (err: any) {
              // TODO: Better error handling
              console.error("Error while applying transformer:", err.toString())
              row[columnIndex] = err.toString()
            }
          }
        }
      }
    }
  }
  console.timeEnd("applyTransfomer")

  const columnValueCounts = countValues(headerRow, displayedData)

  // Apply filter and sorting
  console.time("filterAndSorting")
  displayedData = filters.length
    ? displayedData.filter((row) => {
        return filters.every((filter) =>
          filter.includedValues.some(
            (filterValue) =>
              filterValue === valueAsString(row[filter.columnIndex]),
          ),
        )
      })
    : displayedData

  // When ':' is used search
  const searchSplits = search.split(":")
  const searchColumn = columnValueCounts.find(
    (ci) => ci.columnName === searchSplits[0],
  )
  const isColumnSearch = searchSplits.length > 1 && !!searchColumn
  const searchValue = isColumnSearch ? searchSplits.slice(1).join(":") : search

  displayedData = search.length
    ? displayedData.filter((row) => {
        if (isColumnSearch) {
          return valueAsString(row[searchColumn.columnIndex]).includes(
            searchValue,
          )
        } else {
          return row.some((value) => valueAsString(value).includes(searchValue))
        }
      })
    : displayedData

  if (sortSetting) {
    displayedData = orderBy(
      displayedData,
      (e) => e[sortSetting?.columnIndex],
      sortSetting.sortOrder,
    )
  }
  console.timeEnd("filterAndSorting")

  // console.log("displayedData", displayedData);

  let fileInfos: string[] = [] // TODO
  const isFiltered = filters.length || search.length

  if (currentFile) {
    fileInfos.push(formatBytes(currentFile.size))
  }
  if (allRows.length) {
    fileInfos.push(`${allRows.length} rows`)
  }
  if (isFiltered) {
    fileInfos.push(`${displayedData.length} filtered`)
  }

  let parsingState: "initial" | "parsing" | "finished" = "initial"

  if (currentFile && !allRows.length) {
    parsingState = "parsing"
  } else if (currentFile && allRows.length) {
    parsingState = "finished"
  }

  const getExportFileName = (newEnding: string): string => {
    return (
      currentFile!.name.substring(
        0,
        currentFile!.name.lastIndexOf(".") > 0
          ? currentFile!.name.lastIndexOf(".")
          : currentFile!.name.length,
      ) +
      "." +
      newEnding
    )
  }

  const getExportData = (): any[][] => {
    // Need to filter columns as they are still part of displayed data for index consistency
    return [headerRow, ...displayedData].map((row) =>
      row.filter((v, i) => !hiddenColumns.includes(i)),
    )
  }

  const exportPopoverEntries = [
    [
      {
        text: "Export as CSV",
        icon: <ArchiveBoxArrowDownIconSolid />,
        onSelect: () => {
          const fileName = getExportFileName("csv")
          saveFile(
            new Blob([
              stringifyCSV(getExportData(), {
                cast: {
                  boolean: (v) => String(v),
                },
              }),
            ]),
            fileName,
          )
        },
      },
      {
        text: "Export as XLSX",
        icon: <ArchiveBoxArrowDownIconSolid />,
        onSelect: () => {
          const fileName = getExportFileName("xlsx")
          const workbook = XLSX.utils.book_new()
          const worksheet = XLSX.utils.aoa_to_sheet(getExportData())
          XLSX.utils.book_append_sheet(workbook, worksheet, fileName)
          XLSX.writeFile(workbook, fileName, {
            bookType: "xlsx",
            compression: true,
          })
        },
      },
      {
        text: "Export as JSON",
        icon: <ArchiveBoxArrowDownIconSolid />,
        onSelect: () => {
          const fileName = getExportFileName("json")
          saveFile(
            new Blob([
              JSON.stringify(tableToJson(getExportData()), null, "\t"),
            ]),
            fileName,
          )
        },
      },
    ],
  ]

  // console.log(displayedData)

  const clearFilterButton = isFiltered ? (
    <button
      onPointerDown={() => {
        setFilters([])
        setSearch("")
      }}
      className="bg-transparent align-bottom text-sm text-gray-500 rounded-full p-1 hover:bg-gray-200 transition-colors duration-300"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M6 18L18 6M6 6l12 12"
        ></path>
      </svg>
    </button>
  ) : null

  return (
    <main
      ref={drop}
      className="h-screen p-2"
      onPaste={(e) => {
        // Do not want to replace current data in case of accidental paste
        if (!currentFile) {
          const contentAsText = e.clipboardData.getData("text")
          // console.log(contentAsText)
          parseText(contentAsText)
        }
      }}
    >
      {(() => {
        switch (parsingState) {
          case "initial":
            return (
              <div>
                <h1 className="text-6xl text-gray-700 m-4">FileGlance</h1>
                <div className="text-2xl text-gray-500 m-4">
                  Simple, privacy-friendly tool for working with tabular data
                </div>
                <div className="flex flex-col items-center">
                  <FileChooser
                    handleFileSelected={handleFileSelected}
                    isDragging={dragging}
                  ></FileChooser>
                  <span className="text-xl text-gray-500">
                    Just want to play around?
                  </span>

                  <button
                    onPointerDown={onGenerateSampleData}
                    className="text-xl hover:bg-gray-100 text-gray-600 font-semibold py-2 px-4 rounded"
                  >
                    Load sample data
                  </button>
                </div>
              </div>
            )
          case "parsing":
            return (
              <div className="flex h-screen">
                <div className="m-auto text-2xl text-gray-500">
                  <span>parsing</span>
                  <span> {currentFile?.name || ""} </span>
                  <span>...</span>
                </div>
              </div>
            )
          case "finished":
            return (
              <React.Fragment>
                <div className="mb-2 flex flex-row items-center justify-between">
                  <div>
                    <span className="text-2xl">{currentFile?.name || ""} </span>
                    <span className="text-gray-500 text-sm">
                      {fileInfos.join(", ")}
                    </span>
                    {clearFilterButton}
                  </div>
                  <div className="flex gap-1">
                    <button
                      ref={exportButtonRef}
                      onPointerDown={() => {
                        setPopoverAnchorElement(exportButtonRef.current)
                      }}
                      className="text-gray-700 py-2 px-2 hover:bg-gray-100 hover:text-gray-950 p-2 rounded-md"
                    >
                      <ArchiveBoxArrowDownIcon className="size-5" />
                    </button>
                    <MenuPopover
                      id={"exportPopover"}
                      menuItems={exportPopoverEntries}
                      open={Boolean(popoverAnchorElement)}
                      anchorEl={popoverAnchorElement}
                      onClose={handlePopoverClose}
                      onSelect={() => setPopoverAnchorElement(null)}
                      anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "left",
                      }}
                    ></MenuPopover>
                    {/* TODO:Implement export dialog */}
                    <Modal id="exportDialog" open={false} onClose={() => {}}>
                      <div className="m-auto text-2xl text-gray-700">
                        <span>Export</span>
                      </div>
                    </Modal>
                    <input
                      type="search"
                      className="min-w-52 bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg p-2"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value)
                      }}
                      onPaste={(e) => {
                        e.stopPropagation()
                      }}
                      placeholder="Search"
                    ></input>
                  </div>
                </div>
                <div className="flex flex-row h-[calc(100vh-60px)] overflow-clip">
                  <ValuesInspector
                    columnValueCounts={columnValueCounts}
                    filters={filters}
                    onFilterToggle={onFilterToggle}
                    openAccordions={openAccordions}
                    onToggleAccordion={(columnIndex: number) => {
                      setOpenAccordions(
                        addOrRemove(openAccordions, columnIndex),
                      )
                    }}
                    hiddenColumns={hiddenColumns}
                    onToggleColumnVisibility={(columnIndex: number) => {
                      setHiddenColumns(addOrRemove(hiddenColumns, columnIndex))
                    }}
                  ></ValuesInspector>
                  <DataTable
                    key={currentFile?.name}
                    headerRow={headerRow}
                    rows={displayedData}
                    columnValueCounts={columnValueCounts}
                    hiddenColumns={hiddenColumns}
                    sortSetting={sortSetting}
                    onSortingChange={(e) => {
                      if (e.sortOrder !== "unsorted") {
                        setSortSetting(e as SortSetting)
                      } else {
                        setSortSetting(null)
                      }
                    }}
                    onTransformerAdded={(e) => {
                      console.log("onTransformerAdded", e)
                      setTransformers([...transformers, e])
                      // Remove column filters if present as they might conflict with new values
                      setFilters(
                        filters.filter((f) => f.columnIndex !== e.columnIndex),
                      )
                    }}
                  ></DataTable>
                </div>
              </React.Fragment>
            )
        }
      })()}
    </main>
  )
}

const addOrRemove = (arr: any[], item: any) =>
  arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]

function formatBytes(bytes: number, dp = 1): string {
  const thresh = 1000

  if (Math.abs(bytes) < thresh) {
    return bytes + " B"
  }

  const units = ["kB", "MB", "GB", "TB"]
  let u = -1
  const r = 10 ** dp

  do {
    bytes /= thresh
    ++u
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  )

  return bytes.toFixed(dp) + " " + units[u]
}

function detectDelimiter(input: string): string | null {
  console.time("detectDelimiter")
  const supportedDelimiters = [",", ";", "|", "\t"]
  const counts: Record<string, number> = {}
  for (const c of input.substring(0, 10_000)) {
    if (supportedDelimiters.includes(c)) {
      counts[c] = (counts[c] || 0) + 1
    }
  }
  // console.log(counts)
  const maxEntry = maxBy(Object.entries(counts), (_) => _[1])!
  console.log("detected delimiter: ", maxEntry)
  console.timeEnd("detectDelimiter")

  return maxEntry ? maxEntry[0] : null
}

type ValuInfos = {
  valueCount: number
  value: any
}

type CountMap = Record<string, ValuInfos>

function countValues(headers: string[], input: string[][]): ColumnInfos[] {
  console.time("countValues")
  const countsPerColumn: CountMap[] = headers.map((v, i) => ({}))

  input.forEach((row, rowIndex) => {
    // console.log(row);
    row.forEach((value, valueIndex) => {
      // const currentColumn = headers[valueIndex];
      countsPerColumn[valueIndex][value] = {
        valueCount: (countsPerColumn[valueIndex][value]?.valueCount || 0) + 1,
        value: value, // Preserve original value (w/o converting to string)
      }
    })
  })

  const columnInfos = countsPerColumn.map((v, i) => {
    const columnIndex = i
    const columnName = headers[columnIndex]
    const columnValues = Object.entries(v).map((e) => ({
      valueName: e[0],
      valueCount: e[1].valueCount,
      value: e[1].value,
    }))
    const valuesMaxLength = Math.max(
      0,
      ...columnValues.map((value) => `${value.valueName}`.length),
    )

    const isEmptyColumn = valuesMaxLength === 0

    return {
      columnIndex,
      columnName,
      columnValues,
      valuesMaxLength,
      isEmptyColumn,
    }
  })

  console.timeEnd("countValues")

  // console.log("columnInfos", columnInfos)

  return columnInfos
}

/**
 * Helper function to pick array property from json (if not root is already array)
 * Heuristic: Take the top level property with the most entries
 * @param json
 * @returns
 */
function findArray(json: any): any[] | null {
  if (Array.isArray(json)) {
    return json
  }

  let arrayProp = null
  for (let key in json) {
    if (json.hasOwnProperty(key)) {
      let value = json[key]
      const existingCandidateLength = arrayProp ? json[arrayProp]?.length : 0
      if (Array.isArray(value) && value.length > existingCandidateLength) {
        arrayProp = key
      }
    }
  }

  console.log("arry property used: ", arrayProp)

  return arrayProp ? json[arrayProp] : null
}

export interface ColumnFilter {
  columnIndex: number
  includedValues: string[]
}
