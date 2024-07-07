"use client"

import React from "react"

import { maxBy, sum } from "lodash"
import * as jschardet from "jschardet"
// import { Buffer } from "buffer"

import * as XLSX from "xlsx"
import { parse } from "csv-parse/browser/esm/sync"
import { ColumnInfos, ValuesInspector } from "./components/ValueInspector"
import { DataTable } from "./components/DataTable"
import { FileChooser } from "./components/FileChooser"

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

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const parseFile = async (file: File) => {
    setCurrentFile(file)

    console.time("parseFile")
    let data: string[][]
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
      var enc = new TextDecoder("utf-8") // TODO: How to detect file encoding better?

      const parsedContent: any = await file
        .arrayBuffer()
        .then((v) => JSON.parse(enc.decode(v)))

      const arrayData = findArray(parsedContent)

      if (arrayData) {
        const jsonAsTable = jsonToTable(arrayData)
        data = jsonAsTable.data
        setHeaderRow(jsonAsTable.headerRow)
        isHeaderSet = true
      } else {
        data = []
        console.error("No array in JSON found")
      }
    } else {
      // Somehow-Separated text
      const contentAsText: string = await file.arrayBuffer().then((v) => {
        // @ts-ignore: ts does not know about Buffer coming from next.js polyfill
        const fileEncoding = jschardet.detect(Buffer.from(new Uint8Array(v)))
        console.log("file encoding", fileEncoding)
        var enc = new TextDecoder(fileEncoding?.encoding || "utf-8")
        return enc.decode(v)
      })
      const delimiter = detectDelimiter(contentAsText)
      data = parse(contentAsText, { delimiter })
      // console.log(data)
    }

    if (!isHeaderSet) {
      // TODO: Apply header row detection and synthetic generation if not present
      const _headerRow = data.shift()!
      setHeaderRow(_headerRow)
    }

    setAllRows(data)

    console.timeEnd("parseFile")

    // setcColumnValueCounts(columnValueCounts);
  }

  const onGenerateSampleData = () => {
    setCurrentFile(
      new File([], "Generated-Sample.csv", {
        lastModified: new Date().getTime(),
      }),
    )
    setHeaderRow([
      "ID",
      "Name",
      "Age",
      "Email",
      "Phone Number",
      "Country",
      "City",
      "Job Title",
      "Salary",
      "Happiness Score",
      "Favorite Emoji",
      "Date Joined",
      "Last Purchase Amount",
      "Favorite Color",
      "Has Pet",
      "Pet Type",
      "Number of Siblings",
      "Favorite Cuisine",
      "Notes",
    ])
    setAllRows(jsonToTable(generateSampleData(100)).data)
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
    <main className="h-screen p-2">
      <div ref={drop}>
        {allRows?.length ? (
          <React.Fragment>
            <div className="mb-2">
              <span className="text-2xl">{currentFile?.name || ""} </span>
              <span className="text-gray-500 text-sm">
                {fileInfos.join(", ")}
              </span>
              {clearFilterButton}
            </div>
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
                        includedValues:
                          existingColFilter.includedValues.includes(valueName)
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
          </React.Fragment>
        ) : (
          <div className="flex flex-col items-center">
            <FileChooser
              handleFileSelected={handleFileSelected}
              // TODO: Animate dragging feedback
              isDragging={false}
            ></FileChooser>
            <button
              onClick={onGenerateSampleData}
              className=" hover:bg-gray-100 text-gray-600 font-semibold py-2 px-4 rounded"
            >
              Load sample data
            </button>
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

function jsonToTable(jsonArray: Array<any>): {
  data: any[][]
  headerRow: string[]
} {
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
  return { data: rows, headerRow: header }
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomElement(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateSampleData(numRows: number): any[] {
  const firstNames = [
    "John",
    "Jane",
    "Emily",
    "Michael",
    "Alice",
    "Robert",
    "David",
    "Laura",
    "James",
    "Mary",
    "Chris",
    "Emma",
    "Matthew",
    "Olivia",
    "Daniel",
    "Sophia",
    "Andrew",
    "Sophia",
    "Logan",
    "Amelia",
    "Lucas",
    "Isabella",
    "James",
    "Evelyn",
    "Benjamin",
    "Ava",
    "Oliver",
    "Charlotte",
    "Alexander",
    "Amelia",
    "Jack",
    "Charlotte",
  ]
  const lastNames = [
    "Doe",
    "Smith",
    "Rogers",
    "Johnson",
    "Williams",
    "Brown",
    "Davis",
    "Wilson",
    "Anderson",
    "Martinez",
    "Lee",
    "Harris",
    "Clark",
    "Lewis",
    "Walker",
    "Young",
    "King",
    "Mitchell",
    "Phillips",
    "Campbell",
    "Mitchell",
    "Carter",
    "Parker",
    "Morris",
    "Roberts",
    "Scott",
    "Edwards",
    "Green",
    "Moore",
    "White",
    "Lee",
    "Harris",
  ]
  const countries = ["USA", "UK", "Canada", "Australia"]
  const cities = [
    "New York",
    "London",
    "Toronto",
    "Sydney",
    "Chicago",
    "Los Angeles",
    "San Francisco",
    "Manchester",
    "Vancouver",
    "Melbourne",
    "Miami",
    "Calgary",
    "Edinburgh",
    "Boston",
    "Ottawa",
    "Adelaide",
    "Seattle",
    "Liverpool",
    "Hamilton",
    "Brisbane",
    "Denver",
    "Quebec",
    "Leeds",
    "Canberra",
    "Houston",
  ]
  const jobTitles = [
    "Software Engineer",
    "Marketing Manager",
    "Data Analyst",
    "Project Manager",
    "Designer",
    "Teacher",
    "Engineer",
    "Accountant",
    "Manager",
    "Doctor",
    "Chef",
    "Writer",
    "Architect",
    "Artist",
    "Scientist",
    "Consultant",
    "Photographer",
    "Lawyer",
  ]
  const emojis = [
    "😊",
    "🎉",
    "❤️",
    "😎",
    "🔥",
    "⚙️",
    "🧬",
    "💻",
    "📊",
    "📋",
    "🔋",
    "🏗️",
    "✍️",
    "📸",
    "🍽️",
    "🔧",
    "📰",
  ]
  const colors = ["Blue", "Red", "Green", "Yellow", "Purple", "Orange", "Pink"]
  const cuisines = [
    "Italian",
    "Indian",
    "Chinese",
    "Mexican",
    "French",
    "Japanese",
    "Spanish",
  ]

  const data = []
  for (let i = 1; i <= numRows; i++) {
    const id = i
    const name =
      getRandomElement(firstNames) + " " + getRandomElement(lastNames)
    const age = getRandomInt(20, 50)
    const email = name.split(" ").join("").toLowerCase() + "@example.com"
    const phoneNumber = "555-" + getRandomInt(1000, 9999)
    const country = getRandomElement(countries)
    const city = getRandomElement(cities)
    const jobTitle = getRandomElement(jobTitles)
    const salary = getRandomInt(50000, 150000)
    const happinessScore = getRandomInt(1, 5)
    const favoriteEmoji = getRandomElement(emojis)
    const dateJoined = `${getRandomInt(2017, 2021)}-${getRandomInt(1, 12).toString().padStart(2, "0")}-${getRandomInt(1, 28).toString().padStart(2, "0")}`
    const lastPurchaseAmount = getRandomInt(0, 1000).toFixed(2)
    const favoriteColor = getRandomElement(colors)
    const hasPet = getRandomElement(["Yes", "No"])
    const petType =
      hasPet === "Yes" ? getRandomElement(["Dog", "Cat", "Fish"]) : ""
    const numberOfSiblings = getRandomInt(0, 4)
    const favoriteCuisine = getRandomElement(cuisines)
    const notes = getRandomElement([
      "",
      "",
      "Loves spicy food",
      "Works remotely",
      "Enjoys painting",
      "Frequent traveler",
      "Close to retirement",
    ])

    data.push({
      id,
      name,
      age,
      email,
      phoneNumber,
      country,
      city,
      jobTitle,
      salary,
      happinessScore,
      favoriteEmoji,
      dateJoined,
      lastPurchaseAmount,
      favoriteColor,
      hasPet,
      petType,
      numberOfSiblings,
      favoriteCuisine,
      notes,
    })
  }
  return data
}

export interface ColumnFilter {
  columnIndex: number
  includedValues: string[]
}
