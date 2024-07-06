"use client"

import React from "react"

import { maxBy, sum } from "lodash"
import * as XLSX from "xlsx"
import { parse } from "csv-parse/browser/esm/sync"
import { ColumnInfos, ValuesInspector } from "./components/ValueInspector"
import { DataTable } from "./components/DataTable"

export default function Home() {
  const [dragging, setDragging] = React.useState(false)
  const [currentFile, setCurrentFile] = React.useState<File>()

  const [openAccordions, setOpenAccordions] = React.useState<number[]>([])
  const [hiddenColumns, setHiddenColumns] = React.useState<number[]>([])

  const [headerRow, setHeaderRow] = React.useState<Array<string>>([])
  const [allRows, setAllRows] = React.useState<Array<any>>([])
  const [filters, setFilters] = React.useState<Array<ColumnFilter>>([])
  // const [columnValueCounts, setcColumnValueCounts] = React.useState<
  //   ColumnInfos[]
  // >([]);

  const drag = React.useRef(null)
  const drop = React.useRef(null)
  const input = React.useRef(null)

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const parseFile = async (file: File) => {
    setCurrentFile(file)

    console.time("parseFile")
    let data: string[][]
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
      var enc = new TextDecoder("utf-8") // TODO: How to detect file encoding better?

      const parsedContent: any = await file
        .arrayBuffer()
        .then((v) => JSON.parse(enc.decode(v)))

      const arrayData = findArray(parsedContent)

      if (arrayData) {
        data = jsonToTable(arrayData)
      } else {
        data = []
        console.error("No array in JSON found")
      }
    } else {
      // Somehow-Separated text
      var enc = new TextDecoder("utf-8") // TODO: How to detect file encoding better?

      const contentAsText: string = await file
        .arrayBuffer()
        .then((v) => enc.decode(v))
      const delimiter = detectDelimiter(contentAsText)
      data = parse(contentAsText, { delimiter })
      // console.log(data)
    }

    // TODO: Apply header row detection and synthetic generation if not present
    const _headerRow = data.shift()!

    console.timeEnd("parseFile")

    setHeaderRow(_headerRow)
    setAllRows(data)

    // setcColumnValueCounts(columnValueCounts);
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setDragging(false)

    const files = e.dataTransfer ? [...e.dataTransfer.files] : []

    console.log(files)
    if (files.length) {
      const firstFile = files[0]
      parseFile(firstFile)
    }
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || [])
    console.log("files:", files)

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

    if (e.target !== drag.current) {
      setDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // console.log("handleDragLeave", e);

    if (e.target === drag.current) {
      setDragging(false)
    }
  }

  React.useEffect(() => {
    // @ts-ignore
    drop.current.addEventListener("dragover", handleDragOver)
    // @ts-ignore
    drop.current.addEventListener("drop", handleDrop)
    // @ts-ignore
    drop.current.addEventListener("dragenter", handleDragEnter)
    // @ts-ignore
    drop.current.addEventListener("dragleave", handleDragLeave)

    return () => {
      // @ts-ignore
      drop.current.removeEventListener("dragover", handleDragOver)
      // @ts-ignore
      drop.current.removeEventListener("drop", handleDrop)
      // @ts-ignore
      drop.current.removeEventListener("dragenter", handleDragEnter)
      // @ts-ignore
      drop.current.removeEventListener("dragleave", handleDragLeave)
    }
  }, [])

  const InitialUI = () => {
    return (
      <div className="w-4/6 max-w-2xl mx-auto my-24">
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-10 h-10 mb-3 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M4 2h12l6 6v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
                <line x1="4" y1="10" x2="20" y2="10"></line>
                <line x1="8" y1="14" x2="16" y2="14"></line>
                <line x1="8" y1="18" x2="16" y2="18"></line>
              </svg>
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Choose file</span> or{" "}
                <span className="font-semibold">drag and drop</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                CSV, TSV, XLSX, JSON, TXT
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={handleFileSelected}
            />
          </label>
        </div>
      </div>
    )
  }

  // Apply filter and sorting
  console.time("filterAndSorting")
  const displayedData = filters.length
    ? allRows.filter((row) => {
        return filters.every((filter) =>
          filter.includedValues.some(
            (value) => value === row[filter.columnIndex],
          ),
        )
      })
    : allRows
  console.timeEnd("filterAndSorting")

  // console.log("displayedData", displayedData);

  let fileInfos: string[] = [] // TODO

  if (currentFile) {
    fileInfos.push(formatBytes(currentFile.size))
  }
  if (allRows.length) {
    fileInfos.push(`${allRows.length} rows`)
  }
  if (filters.length) {
    fileInfos.push(`${displayedData.length} filtered`)
  }

  const clearFilterButton = filters.length ? (
    <button
      onPointerDown={() => {
        setFilters([])
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

  const columnValueCounts = countValues(headerRow, allRows)

  return (
    <main ref={drop} className="h-screen p-2">
      <div className="mb-2">
        <span className="text-2xl">{currentFile?.name || ""} </span>
        <span className="text-gray-500 text-sm">{fileInfos.join(", ")}</span>
        {clearFilterButton}
      </div>
      {allRows?.length ? (
        <div className="flex flex-row h-[calc(100vh-60px)] overflow-clip">
          <ValuesInspector
            columnValueCounts={columnValueCounts}
            filters={filters}
            onFilterToggle={(
              columnIndex: number,
              valueName: string,
              isAdding: boolean,
            ) => {
              let newColFilter: ColumnFilter
              const existingColFilter = filters.find(
                (_) => _.columnIndex === columnIndex,
              )
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
                    includedValues: existingColFilter.includedValues.includes(
                      valueName,
                    )
                      ? existingColFilter.includedValues.filter(
                          (iv) => iv !== valueName,
                        )
                      : [valueName],
                  }
                }
              }
              const updatedFilters = [
                ...filters.filter((_) => _.columnIndex !== columnIndex),
                newColFilter,
              ].filter((f) => f.includedValues.length)
              setFilters(updatedFilters)
              // console.log("updatedFilters", updatedFilters);
            }}
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
      ) : (
        <InitialUI></InitialUI>
      )}
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
  console.log(counts)
  const maxEntry = maxBy(Object.entries(counts), (_) => _[1])!
  console.log(maxEntry)
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

    return {
      columnIndex,
      columnName,
      columnValues,
      valuesMaxLength,
    }
  })

  console.timeEnd("countValues")

  return columnInfos
}

function findArray(json: any) {
  // Check if the JSON object itself is an array
  if (Array.isArray(json)) {
    return json
  }

  // Iterate over the properties of the JSON object
  for (let key in json) {
    if (json.hasOwnProperty(key)) {
      let value = json[key]
      // Check if the property is an array and has a length greater than 0
      if (Array.isArray(value) && value.length > 0) {
        return value
      }
    }
  }

  // If no array with length > 0 is found, return null
  return null
}

function jsonToTable(jsonArray: Array<any>) {
  // Helper function to flatten a nested object
  function flattenObject(obj: any, prefix = "") {
    return Object.keys(obj).reduce((acc: any, k) => {
      const pre = prefix.length ? prefix + "." : ""
      if (
        typeof obj[k] === "object" &&
        obj[k] !== null &&
        !Array.isArray(obj[k])
      ) {
        Object.assign(acc, flattenObject(obj[k], pre + k))
      } else {
        acc[pre + k] = obj[k]
      }
      return acc
    }, {})
  }

  // Flatten all objects in the JSON array
  const flatArray = jsonArray.map((item) => flattenObject(item))

  // Create the header row
  const header = Array.from(
    new Set(flatArray.flatMap((item) => Object.keys(item))),
  )

  // Create the data rows
  const rows = flatArray.map((item) => header.map((h) => item[h] ?? ""))

  // Combine the header and data rows
  return [header, ...rows]
}

export interface ColumnFilter {
  columnIndex: number
  includedValues: string[]
}
