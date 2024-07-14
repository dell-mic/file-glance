"use client"

import React from "react"

import { maxBy } from "lodash"

import * as XLSX from "xlsx"
import { parse } from "csv-parse/browser/esm/sync"
import { ColumnInfos, ValuesInspector } from "./components/ValueInspector"
import { DataTable } from "./components/DataTable"
import { FileChooser } from "./components/FileChooser"
import {
  generateSampleData,
  jsonToTable,
  readFileToString,
  valueAsString,
} from "@/utils"

export default function Home() {
  const [dragging, setDragging] = React.useState(false)
  const [currentFile, setCurrentFile] = React.useState<File>()

  const [openAccordions, setOpenAccordions] = React.useState<number[]>([])
  const [hiddenColumns, setHiddenColumns] = React.useState<number[]>([])
  const [columnValueCounts, setColumnValueCounts] = React.useState<
    ColumnInfos[]
  >([])

  const [headerRow, setHeaderRow] = React.useState<Array<string>>([])
  const [allRows, setAllRows] = React.useState<any[][]>([])
  const [filters, setFilters] = React.useState<Array<ColumnFilter>>([])
  const [search, setSearch] = React.useState<string>("")
  // const [columnValueCounts, setcColumnValueCounts] = React.useState<
  //   ColumnInfos[]
  // >([]);

  const drop = React.useRef(null)

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const parseFile = async (file: File) => {
    console.time("parseFile")
    let data: string[][]
    let _headerRow: string[] = []
    let isHeaderSet = false
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      const fileAsArrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(fileAsArrayBuffer)
      console.log("workbook.SheetNames", workbook.SheetNames)
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      console.log("firstSheet", firstSheet)
      data = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        blankrows: true,
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
      data = parse(contentAsText, { delimiter })
      // console.log(data)
    }

    if (!isHeaderSet) {
      // TODO: Apply header row detection and synthetic generation if not present
      _headerRow = data.shift()!
    }
    setData(file, _headerRow, data)
    console.timeEnd("parseFile")
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

  const setData = (file: File, headerRow: string[], data: string[][]) => {
    setCurrentFile(file)
    setHeaderRow(headerRow)
    setAllRows(data)

    const _columnValueCounts = countValues(headerRow, data)

    setColumnValueCounts(_columnValueCounts)

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

  console.log("dragging", dragging)

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

  // Apply filter and sorting
  console.time("filterAndSorting")
  let displayedData = filters.length
    ? allRows.filter((row) => {
        return filters.every((filter) =>
          filter.includedValues.some(
            (filterValue) =>
              filterValue === valueAsString(row[filter.columnIndex]),
          ),
        )
      })
    : allRows

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
    <main ref={drop} className="h-screen p-2">
      <div>
        {allRows?.length ? (
          <React.Fragment>
            <div className="mb-2 flex flex-row items-center justify-between">
              <div>
                <span className="text-2xl">{currentFile?.name || ""} </span>
                <span className="text-gray-500 text-sm">
                  {fileInfos.join(", ")}
                </span>
                {clearFilterButton}
              </div>
              <div>
                <input
                  type="search"
                  className="min-w-52 bg-gray-50 border border-gray-300 text-gray-600 text-sm rounded-lg p-2"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
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
                  setOpenAccordions(addOrRemove(openAccordions, columnIndex))
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
              ></DataTable>
            </div>
          </React.Fragment>
        ) : (
          <div>
            <h1 className="text-6xl text-gray-700 m-4">FileGlance</h1>
            <div className="text-2xl text-gray-500 m-4">
              Fast, privacy-friendly viewer for tabular data
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
                onClick={onGenerateSampleData}
                className="text-xl hover:bg-gray-100 text-gray-600 font-semibold py-2 px-4 rounded"
              >
                Load sample data
              </button>
            </div>
          </div>
        )}
      </div>
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

function detectDelimiter(input: string): string {
  const supportedDelimiters = [",", ";", "|", "\t"]
  const counts: Record<string, number> = {}
  for (const c of input) {
    if (supportedDelimiters.includes(c)) {
      counts[c] = (counts[c] || 0) + 1
    }
  }
  // console.log(counts)
  const maxEntry = maxBy(Object.entries(counts), (_) => _[1])!
  console.log("detected delimiter: ", maxEntry)
  return maxEntry[0]
}

type CountMap = Record<string, number>

function countValues(headers: string[], input: string[][]): ColumnInfos[] {
  console.time("countValues")
  const countsPerColumn: CountMap[] = headers.map((v, i) => ({}))

  input.forEach((row, rowIndex) => {
    // console.log(row);
    row.forEach((value, valueIndex) => {
      // const currentColumn = headers[valueIndex];
      countsPerColumn[valueIndex][value] =
        (countsPerColumn[valueIndex][value] || 0) + 1
    })
  })

  const columnInfos = countsPerColumn.map((v, i) => {
    const columnIndex = i
    const columnName = headers[columnIndex]
    const columnValues = Object.entries(v).map((e) => ({
      valueName: e[0],
      valueCount: e[1],
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
