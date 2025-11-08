"use client"

import React, { useCallback, useEffect, useRef } from "react"

import { maxBy, omit } from "lodash-es"

import * as XLSX from "xlsx"
import { parse } from "csv-parse/browser/esm/sync"
import { stringify as stringifyCSV } from "csv-stringify/browser/esm/sync"
import { ColumnInfos, ValuesInspector } from "./components/ValueInspector"
import { FileChooser } from "./components/FileChooser"
import FilterDialog from "./components/FilterDialog"
import {
  base64GzippedToString,
  detectDelimiter,
  generateHeaderRow,
  generateSampleData,
  stringToBase64Gzipped,
  hasHeader,
  jsonToTable,
  readFileToString,
  saveFile,
  tableToJson,
  tryParseJSONObject,
  compressString,
  decompressString,
  generateSyntheticFile,
  findArrayProp,
  formatBytes,
  cleanWorksheetName,
  cleanForFileName,
  trackEvent,
  tryBase64Decode,
  addOrRemove,
  ColumnFilter,
  ColumnFilterSimple,
  FilterValue,
  SortSetting,
  Transformer,
  findEmptyColumns,
  applyFilters,
  countValues,
  createRowProxy,
} from "@/utils"

import { description, title } from "@/constants"
import { ArchiveBoxArrowDownIcon as ArchiveBoxArrowDownIconSolid } from "@heroicons/react/24/solid"
import { MenuPopover } from "../components/ui/Popover"
import { useToast } from "@/hooks/use-toast"
import {
  isMarkdownTable,
  parseMarkdownTable,
  stringifyMarkdownTable,
} from "@/markdownUtils"
import { ClipboardDocumentCheckIcon } from "@heroicons/react/20/solid"
import { ShareIcon } from "@heroicons/react/20/solid"
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { FunnelIcon } from "@heroicons/react/24/outline"
import { FunnelIcon as FunnelIconSolid } from "@heroicons/react/24/solid"
import { CellObject } from "xlsx"
import { BarChart2, Table as TableIcon, Code2 } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DataTable } from "./components/DataTable/DataTable"
import { FreeQuery } from "./components/FreeQuery/FreeQuery"
import Link from "next/link"
import MiddleEllipsis from "@/components/ui/MiddleEllipsis"
import VisualView from "./components/VisualView"
import { Button } from "@/components/ui/button"

export default function Home() {
  const { toast } = useToast()

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

  const [dataFormatAlwaysIncludesHeader, setDataFormatAlwaysIncludesHeader] =
    React.useState<boolean>(false)
  const [dataIncludesHeaderRow, setDataIncludesHeaderRow] =
    React.useState<boolean>(false)
  const [headerRow, setHeaderRow] = React.useState<Array<string>>([])
  const [allRows, setAllRows] = React.useState<any[][]>([])
  const [filters, setFilters] = React.useState<Array<ColumnFilter>>([])
  const [transformers, setTransformers] = React.useState<Array<Transformer>>([])
  const [search, setSearch] = React.useState<string>("")
  const [parsingState, setParsingState] = React.useState<
    "initial" | "parsing" | "finished"
  >("initial")
  const [sortSetting, setSortSetting] = React.useState<SortSetting | null>(null)

  // Calculated values
  const [displayedHeader, setDisplayedHeader] = React.useState<Array<string>>(
    [],
  )
  // const [displayedData, setDisplayedData] = React.useState<any[][]>([])
  const [displayedDataFiltered, setDisplayedDataFiltered] = React.useState<
    any[][]
  >([])
  const [columnInfos, setColumnInfos] = React.useState<ColumnInfos[]>([])

  const [filterDialogOpen, setFilterDialogOpen] = React.useState(false)
  const [filterFunctionCode, setFilterFunctionCode] = React.useState<string>("")
  const [appliedFilterFunctionCode, setAppliedFilterFunctionCode] =
    React.useState<string | null>("")

  const [viewMode, setViewMode] = React.useState<
    "datatable" | "visual" | "freeQuery"
  >("datatable")

  const handlePopoverClose = () => {
    setPopoverAnchorElement(null)
  }

  const drop = React.useRef(null)

  const ExportDelimiter_v1 = ";"

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const displayedDataWorkerRef = useRef<Worker>(null)
  const [calculationInProgress, setCalculationInProgress] =
    React.useState(false)

  // Setup background worker
  useEffect(() => {
    const displayedDataWorker = new Worker(
      new URL("../worker/displayedDataWorker.ts", import.meta.url),
    )

    displayedDataWorker.onmessage = (
      event: MessageEvent<{
        displayedHeader: string[]
        displayedDataFiltered: any[][]
        columnInfos: ColumnInfos[]
      }>,
    ) => {
      // console.log("response from displayedDataWorker", event.data)
      console.timeEnd("displayedDataWorker")
      setDisplayedHeader(event.data.displayedHeader)
      // setDisplayedData(event.data.displayedData)
      setDisplayedDataFiltered(event.data.displayedDataFiltered)
      setColumnInfos(event.data.columnInfos)
      setCalculationInProgress(false)
    }
    displayedDataWorkerRef.current = displayedDataWorker
    return () => {
      displayedDataWorkerRef.current = null
      displayedDataWorker.terminate()
    }
  }, [])

  const importProject = useCallback(
    (p: ProjectExport | string): void => {
      try {
        const project: ProjectExport = typeof p === "string" ? JSON.parse(p) : p
        // console.log(project)

        // parseText(project.data, project.name, false)
        let data, _headerRow: string[]

        const maybeJson = tryParseJSONObject(project.data)

        // For legacy reasons assume CSV if not valid JSON
        if (!maybeJson) {
          data = parse(project.data, {
            delimiter: ExportDelimiter_v1,
            bom: true,
            skip_empty_lines: true,
            relax_column_count: true,
          })
          _headerRow = data.shift()!
        } else {
          const parsed = jsonToTable(maybeJson)
          data = parsed.data
          _headerRow = parsed.headerRow
        }

        setDataIncludesHeaderRow(true)
        setDataFormatAlwaysIncludesHeader(true)
        setTransformers(project.transformers || [])
        if (project.filterFunction) {
          setFilterFunctionCode(project.filterFunction)
          setAppliedFilterFunctionCode(project.filterFunction)
        }

        setFilters(validateFiltersImport(project.filters))
        setSearch(project.search || "")
        setHiddenColumns(project.hiddenColumns || [])
        setSortSetting(project.sortSetting || null)
        // eslint-disable-next-line react-hooks/immutability
        setData(
          generateSyntheticFile(project.data, project.name || "URL data"),
          _headerRow,
          data,
          false,
        )
        toast({
          title: project.name + " loaded",
          description: data.length + " lines",
          variant: "success",
        })
      } catch (error) {
        // Most probably incomplete/corrupted URL data
        console.error(error)
        toast({
          title: "Import failed",
          variant: "error",
        })
        setParsingState("initial")
      }
    },
    [toast],
  )

  const parseFile = useCallback(
    async (file: File, hideEmptyColumns: boolean) => {
      console.time("parseFile")
      //Reset all properties to initial state
      setHiddenColumns([])
      setOpenAccordions([])
      setTransformers([])
      setSearch("")
      setFilters([])
      setFilterFunctionCode("")

      setDataIncludesHeaderRow(false)
      setDataFormatAlwaysIncludesHeader(false)
      setAppliedFilterFunctionCode(null)
      setSortSetting(null)
      setPopoverAnchorElement(null)

      setParsingState("parsing")
      let data: any[][] = []
      let _headerRow: string[] = []
      let isHeaderSet = false
      let errorMessage = ""

      // Import full project (no postprocessing needed / return early)
      if (file.name.toLowerCase().endsWith(".fg")) {
        const data = await file.arrayBuffer()
        const project = await decompressString(data)
        importProject(project)
        return
      }

      // Parse data/content from file (including some postprocessing)
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const fileAsArrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(fileAsArrayBuffer, { cellDates: true })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        // Get the range of the sheet
        const ref = firstSheet["!ref"]
        if (!ref) {
          data = []
        } else {
          const range = XLSX.utils.decode_range(ref)
          const rows: any[][] = []
          for (let rowIdx = range.s.r; rowIdx <= range.e.r; rowIdx++) {
            const row: any[] = []
            for (let colIdx = range.s.c; colIdx <= range.e.c; colIdx++) {
              const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
              const cell: CellObject = firstSheet[cellRef]
              if (!cell) {
                row.push("")
              } else if (cell.t === "d" && cell.v instanceof Date) {
                row.push(cell.v)
              } else if (cell.t === "n") {
                row.push(cell.v)
              } else if (cell.t === "b") {
                row.push(!!cell.v)
              } else if (cell.t === "e") {
                row.push(null)
              } else {
                row.push(cell.v)
              }
            }
            rows.push(row)
          }
          data = rows
        }
      } else if (file.name.toLowerCase().endsWith(".json")) {
        const contentAsText: string = await readFileToString(file)

        const parsedContent: any = JSON.parse(contentAsText)

        const arrayData = findArrayProp(parsedContent)

        if (arrayData) {
          const jsonAsTable = jsonToTable(arrayData)
          data = jsonAsTable.data
          _headerRow = jsonAsTable.headerRow
          isHeaderSet = true
          setDataFormatAlwaysIncludesHeader(true)
          setDataIncludesHeaderRow(true)
        } else {
          data = []
          _headerRow = []
          errorMessage = "No array in JSON found"
        }
      } else if (file.name.toLowerCase().endsWith(".md")) {
        const contentAsText: string = await readFileToString(file)

        const markdownParsingResult = parseMarkdownTable(contentAsText)
        data = markdownParsingResult.rows
        _headerRow = markdownParsingResult.headerRow
        isHeaderSet = true
        setDataFormatAlwaysIncludesHeader(true)
        setDataIncludesHeaderRow(true)
        // console.log(
        //   "Parsed as markdown with headers:",
        //   markdownParsingResult.headerRow,
        // )
      } else {
        const contentAsText: string = await readFileToString(file)

        // Assume somehow-Separated text
        console.time("detectDelimiter")
        const delimiter = detectDelimiter(contentAsText)
        console.timeEnd("detectDelimiter")
        console.log("detected delimiter: ", delimiter)
        if (delimiter) {
          try {
            data = parse(contentAsText, {
              delimiter,
              bom: true,
              skip_empty_lines: true,
              relax_column_count: true,
              relax_quotes: true,
            })
          } catch (err) {
            console.error(err)
            errorMessage = "Parsing failed"
          }
        } else {
          errorMessage = "No delimiter detected"
        }

        // console.log(data)
      }

      if (data.length) {
        const longestRowLength = maxBy(data, (d) => d.length)!.length
        if (!isHeaderSet) {
          console.time("hasHeader")
          const headerDetected = hasHeader(data)
          console.timeEnd("hasHeader")
          console.log("headerDetected", headerDetected)
          setDataIncludesHeaderRow(headerDetected)
          // header row detection and synthetic generation if not present
          if (headerDetected) {
            _headerRow = data.shift()!
            _headerRow = generateHeaderRow(longestRowLength, _headerRow)
          } else {
            _headerRow = generateHeaderRow(longestRowLength)
          }
        }

        // Fill shorter rows with null values if needed
        for (const row of data) {
          if (row.length < longestRowLength) {
            row.push(...Array(longestRowLength - row.length).fill(null))
          }
        }

        toast({
          title: file.name + " parsed",
          description: data.length + " lines found",
          variant: "success",
        })
        setData(file, _headerRow, data, hideEmptyColumns)
      } else {
        console.error(errorMessage)
        toast({
          title: "File not supported!",
          description: errorMessage,
          variant: "error",
        })
        setData(null, [], [], true)
      }
      console.timeEnd("parseFile")
    },
    [importProject, toast],
  )

  const parseText = useCallback(
    (text: string, syntheticFileName: string, hideEmptyColumns: boolean) => {
      setParsingState("parsing")
      // detect if text looks like proper json
      const isJson = tryParseJSONObject(text) !== false
      if (isJson) {
        syntheticFileName += ".json"
      } else if (isMarkdownTable(text)) {
        syntheticFileName += ".md"
      } else {
        // If no ending parsing logic will attempt CSV parings
      }

      // TODO: A bit hacky and inefficient, but easy way to re-use existing parseFile method
      const syntheticFile = generateSyntheticFile(text, syntheticFileName)
      parseFile(syntheticFile, hideEmptyColumns)
    },
    [parseFile],
  )

  const onGenerateSampleData = (rowsAmount = 1337) => {
    const simulatedFileBytes = Array.from(
      { length: rowsAmount * 50 },
      () => "1",
    ).join()
    const sampleData = generateSampleData(rowsAmount)
    setData(
      generateSyntheticFile(simulatedFileBytes, "Generated-Sample.csv"),
      sampleData.headerRow,
      jsonToTable(sampleData.data).data,
      true,
    )
    setDataIncludesHeaderRow(true)
    setDataFormatAlwaysIncludesHeader(true)
  }

  const onClickFeedbackCta = () => {
    // const path = window.location.pathname.replace(/^\/|\/$/g, "")
    const host = window.location.hostname.replace(/^www\./, "")
    const mailtoLink = `mailto:feedback@${host}?subject=Feedback ${host}`
    window.open(mailtoLink, "_blank")
    trackEvent("Button", "FeedbackCta")
  }

  const setData = (
    file: File | null,
    headerRow: string[],
    data: string[][],
    hideEmptyColumns: boolean,
  ) => {
    if (!file || !headerRow?.length) {
      document.title = title
      setCurrentFile(null)
      setHeaderRow([])
      setAllRows([])

      setParsingState("initial")
      return
    }

    setCurrentFile(file)
    setHeaderRow(headerRow)
    setAllRows(data)

    // Set displayed data from raw data to display something immediately (will be updated after background calculation finishes)
    setDisplayedHeader(headerRow)
    setDisplayedDataFiltered(data)

    setParsingState("finished")

    // TODO: Hacky workaround; somehow document title gets reset in URL parsing case
    document.title = file.name
    setTimeout(() => (document.title = file.name), 200)

    // TODO: More efficient way to find empty columns?
    const emptyColumns = findEmptyColumns(data)

    // Hide empty columns initially
    if (hideEmptyColumns) {
      setHiddenColumns(emptyColumns)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setDragging(false)

    const files = e.dataTransfer ? [...e.dataTransfer.files] : []

    console.log("dropped files:", files)
    if (files.length) {
      const firstFile = files[0]
      if (firstFile.name.endsWith(".fg.json")) {
        const contentAsText: string = await readFileToString(firstFile)

        // eslint-disable-next-line react-hooks/immutability
        importTransformer(contentAsText)
        trackEvent("Transformer", "Drop")
      } else {
        parseFile(firstFile, true)
        trackEvent("File", "Drop")
      }
    }
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || [])
    console.log("selected files:", files)

    e.preventDefault()
    e.stopPropagation()

    if (files.length) {
      const firstFile = files[0]
      parseFile(firstFile, true)
    }

    trackEvent("File", "Select")
  }

  const handleDragEnter = (e: React.DragEvent) => {
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
    const dropRef = drop.current

    // @ts-ignore
    dropRef.addEventListener("dragover", handleDragOver)
    // @ts-ignore
    dropRef.addEventListener("drop", handleDrop)
    // @ts-ignore
    dropRef.addEventListener("dragenter", handleDragEnter)
    // @ts-ignore
    // drop.current.addEventListener("dragleave", handleDragLeave)

    return () => {
      // @ts-ignore
      dropRef.removeEventListener("dragover", handleDragOver)
      // @ts-ignore
      dropRef.removeEventListener("drop", handleDrop)
      // @ts-ignore
      dropRef.removeEventListener("dragenter", handleDragEnter)
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

  // Check URL for data/project hash
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash
      const StartHashContent = 3
      // console.log(hash)
      if (hash) {
        if (hash.startsWith("#d=")) {
          trackEvent("UrlParse", "Data")

          setParsingState("parsing")
          const data = hash.substring(StartHashContent)
          let decoded: string | null
          // If string looks like base64 -> decoded that
          decoded = tryBase64Decode(data)
          // Otherwise assume URI encoded (as it is in hash part of URL that should be enough, decodeURIComponent it not required)
          if (!decoded) {
            decoded = decodeURI(data)
          }
          parseText(decoded, "URL Data", true)
        } else if (hash.startsWith("#c=")) {
          trackEvent("UrlParse", "CompressedData")

          setParsingState("parsing")
          base64GzippedToString(hash.substring(StartHashContent)).then(
            (decompressed) => {
              parseText(decompressed, "URL Data", true)
            },
          )
        } else if (hash.startsWith("#p=")) {
          trackEvent("UrlParse", "Project")
          setParsingState("parsing")

          base64GzippedToString(hash.substring(StartHashContent)).then((p) => {
            importProject(p)
          })
        }
        history.replaceState(undefined, "", "#")
      }
    }
  }, [importProject, parseText])

  // console.log("dragging", dragging)

  const onFilterToggle = (
    columnIndex: number,
    filterValue: FilterValue,
    isAdding: boolean,
  ) => {
    let newColFilter: ColumnFilter
    const existingColFilter = filters.find((_) => _.columnIndex === columnIndex)
    // Easy case: No filter for this column so far => Simply add with clicked value
    if (!existingColFilter) {
      newColFilter = { columnIndex: columnIndex, filterValues: [filterValue] }
    } else {
      if (isAdding) {
        // With meta key pressed allow selecting of several values
        newColFilter = {
          columnIndex: columnIndex,
          filterValues: existingColFilter.filterValues.find(
            (ef) => ef.value === filterValue.value,
          )
            ? existingColFilter.filterValues.filter(
                (iv) => iv.value !== filterValue.value,
              )
            : [...existingColFilter.filterValues, filterValue],
        }
      } else {
        // Deselect already selected / replace
        newColFilter = {
          columnIndex: columnIndex,
          filterValues: existingColFilter.filterValues.find(
            (ef) => ef.value === filterValue.value,
          )
            ? existingColFilter.filterValues.filter(
                (iv) => iv.value !== filterValue.value,
              )
            : [filterValue],
        }
      }
    }
    const updatedFilters = [
      ...filters.filter((_) => _.columnIndex !== columnIndex),
      newColFilter,
    ].filter((f) => f.filterValues.length)
    setFilters(updatedFilters)
  }

  // // Update headerRow based on transformers
  // const displayedHeader = useMemo(() => {
  //   const transformedHeaderRow = cloneDeep(headerRow)
  //   for (const transformer of transformers) {
  //     if (transformer.asNewColumn) {
  //       transformedHeaderRow.splice(
  //         transformer.columnIndex + 1,
  //         0,
  //         transformer.newColumnName ||
  //           headerRow[transformer.columnIndex] + "_NEW",
  //       )
  //     }
  //   }
  //   return transformedHeaderRow
  // }, [headerRow, transformers])

  useEffect(() => {
    if (!allRows?.length) return

    // Run all user-space JS code in worker
    if (transformers.length || !!appliedFilterFunctionCode) {
      console.time("displayedDataWorker")
      setCalculationInProgress(true)
      // Avoid UI lag due to copy/serializing of large data
      setTimeout(() => {
        displayedDataWorkerRef.current?.postMessage({
          allRows,
          transformers,
          headerRow,
          filters,
          search,
          sortSetting,
          appliedFilterFunctionCode,
        })
      }, 1)
    } else {
      // For simple cases do filtering in main thread (todo: also limit for non-large files?)
      const displayedDataFiltered = applyFilters(
        allRows.map((row) => createRowProxy(row, headerRow)),
        headerRow,
        filters,
        search,
        sortSetting,
        appliedFilterFunctionCode,
      )

      const columnInfos = countValues(headerRow, allRows, displayedDataFiltered)
      setDisplayedHeader(headerRow)
      setDisplayedDataFiltered(displayedDataFiltered)
      setColumnInfos(columnInfos)
    }
  }, [
    allRows,
    transformers,
    headerRow,
    filters,
    search,
    sortSetting,
    appliedFilterFunctionCode,
  ])

  // const displayedData = useMemo(() => {
  //   console.time("applyTransfomer")

  //   // Allow access via headerName in subsequent code (esp. user functions)
  //   const transformedData = allRows.map((row) =>
  //     createRowProxy(cloneDeep(row), displayedHeader),
  //   )

  //   if (!transformers.length) {
  //     console.timeEnd("applyTransfomer")
  //     return transformedData
  //   }

  //   for (const [rowIndex, row] of transformedData.entries()) {
  //     for (const columnIndex of row.keys()) {
  //       for (const transformer of transformers) {
  //         if (transformer.columnIndex === columnIndex) {
  //           let newValue
  //           try {
  //             newValue = transformer.transformer(
  //               row[columnIndex],
  //               columnIndex,
  //               rowIndex,
  //               displayedHeader[columnIndex],
  //               transformedData,
  //               allRows[rowIndex][columnIndex],
  //             )
  //           } catch (err: any) {
  //             console.error("Error while applying transformer:", err.toString())
  //             newValue = err.toString()
  //           }
  //           if (transformer.asNewColumn) {
  //             row.splice(columnIndex + 1, 0, newValue)
  //           } else {
  //             row[columnIndex] = newValue
  //           }
  //         }
  //       }
  //     }
  //   }

  //   console.timeEnd("applyTransfomer")
  //   return transformedData
  // }, [allRows, transformers, displayedHeader])

  // const displayedDataFiltered = useMemo(() => {
  //   console.time("filterAndSorting")

  //   const filtersFlat = filters.flatMap((f) =>
  //     f.filterValues.map((fv) => ({ ...fv, columnIndex: f.columnIndex })),
  //   )
  //   const [includeFilters, excludeFilters] = partition(
  //     filtersFlat,
  //     (fv) => fv.included,
  //   )
  //     .map((ff) => groupBy(ff, "columnIndex"))
  //     .map((fg) =>
  //       Object.entries(fg).map((oe) => ({
  //         columnIndex: Number(oe[0]),
  //         filterValues: oe[1].map((fv) => omit(fv, "columnIndex")),
  //       })),
  //     )

  //   let filteredData = filters.length
  //     ? displayedData.filter((row) => {
  //         const isExcluded = excludeFilters.some((filter) =>
  //           filter.filterValues.some((filterValue) => {
  //             if (Array.isArray(row[filter.columnIndex])) {
  //               if (filterValue.value) {
  //                 return row[filter.columnIndex].some(
  //                   (cellValue: any) =>
  //                     filterValue.value === valueAsStringSimplified(cellValue),
  //                 )
  //               } else {
  //                 // "Empty" filter case => Exclude also empty arrays
  //                 return row[filter.columnIndex].length === 0
  //               }
  //             } else {
  //               return (
  //                 filterValue.value ===
  //                 valueAsStringSimplified(row[filter.columnIndex])
  //               )
  //             }
  //           }),
  //         )

  //         // Explicit exclusion should have priority when in doubt
  //         if (isExcluded) {
  //           return false
  //         }

  //         if (includeFilters.length) {
  //           // For inclusion filter: Apply OR logic within the same column, but AND conjunction across columns
  //           const isIncluded = includeFilters.every((filter) =>
  //             filter.filterValues.some((filterValue) => {
  //               if (Array.isArray(row[filter.columnIndex])) {
  //                 if (filterValue.value) {
  //                   return row[filter.columnIndex].some(
  //                     (cellValue: any) =>
  //                       filterValue.value ===
  //                       valueAsStringSimplified(cellValue),
  //                   )
  //                 } else {
  //                   // "Empty" filter case => Include also empty arrays
  //                   return row[filter.columnIndex].length === 0
  //                 }
  //               } else {
  //                 return (
  //                   filterValue.value ===
  //                   valueAsStringSimplified(row[filter.columnIndex])
  //                 )
  //               }
  //             }),
  //           )

  //           return isIncluded
  //         } else {
  //           // No inclusion filter used => Do not filter any out & display all
  //           return true
  //         }
  //       })
  //     : displayedData

  //   const searchSplits = search.split(":")
  //   const searchColumnIndex = displayedHeader.findIndex(
  //     (header) => header === searchSplits[0],
  //   )
  //   const isColumnSearch = searchSplits.length > 1 && searchColumnIndex > -1
  //   const searchValue = isColumnSearch
  //     ? searchSplits.slice(1).join(":")
  //     : search

  //   filteredData = search.length
  //     ? filteredData.filter((row) =>
  //         isColumnSearch
  //           ? searchMatch(row[searchColumnIndex], searchValue)
  //           : row.some((value) => searchMatch(value, searchValue)),
  //       )
  //     : filteredData

  //   // Apply sorting before filter function as might impact results
  //   if (sortSetting) {
  //     filteredData = orderBy(
  //       filteredData,
  //       (e) => e[sortSetting?.columnIndex],
  //       sortSetting.sortOrder,
  //     )
  //   }

  //   // Apply filter function if set
  //   if (appliedFilterFunctionCode) {
  //     const compilationResult = compileFilterCode(
  //       appliedFilterFunctionCode,
  //       displayedData[0],
  //     )
  //     const cache = {}
  //     if (compilationResult.filter && !compilationResult.error) {
  //       filteredData = filteredData.filter((row, i) =>
  //         applyFilterFunction(row, i, compilationResult.filter!, cache),
  //       )
  //     }
  //   }

  //   console.timeEnd("filterAndSorting")

  //   return filteredData
  // }, [
  //   displayedData,
  //   filters,
  //   search,
  //   appliedFilterFunctionCode,
  //   displayedHeader,
  //   sortSetting,
  // ])

  // const columnInfos = useMemo(() => {
  //   return countValues(displayedHeader, displayedData, displayedDataFiltered)
  // }, [displayedHeader, displayedData, displayedDataFiltered])

  const fileInfos: string[] = []
  const isFiltered =
    filters.length > 0 || search.length > 0 || !!appliedFilterFunctionCode

  if (currentFile) {
    fileInfos.push(formatBytes(currentFile.size))
  }
  if (allRows.length) {
    fileInfos.push(`${allRows.length.toLocaleString()} rows`)
  }
  if (isFiltered) {
    fileInfos.push(`${displayedDataFiltered.length.toLocaleString()} filtered`)
  } else {
    fileInfos.push("all shown")
  }

  const getExportFileName = (newEnding: string): string => {
    const currentFileName = currentFile!.name.substring(
      0,
      currentFile!.name.lastIndexOf(".") > 0
        ? currentFile!.name.lastIndexOf(".")
        : currentFile!.name.length,
    )
    return cleanForFileName(currentFileName) + "." + newEnding
  }

  const exportProject = (): ProjectExport => {
    const project = {
      v: 1,
      name: currentFile!.name!,
      data: JSON.stringify(tableToJson([headerRow, ...allRows])),
      transformers: transformers.map((t) => omit(t, "transformer")),
      hiddenColumns: hiddenColumns,
      filters: filters,
      filterFunction: appliedFilterFunctionCode,
      search: search,
      sortSetting: sortSetting,
    }
    return project
  }

  interface ExportOptions {
    stringifyArrays?: boolean
  }

  const getExportData = (options?: Partial<ExportOptions>): any[][] => {
    const stringifyArrays = options?.stringifyArrays ?? false
    // Need to filter columns as they are still part of displayed data for index consistency
    return [displayedHeader, ...displayedDataFiltered].map((row) =>
      row
        .filter((v, i) => !hiddenColumns.includes(i))
        .map((v) => (stringifyArrays && Array.isArray(v) ? String(v) : v)),
    )
  }

  const exportTransformer = (): TransformerExport => {
    const transformerExport = {
      v: 1,
      transformers: transformers.map((t) => omit(t, "transformer")),
      hiddenColumns: hiddenColumns,
      filters: filters,
      filterFunction: appliedFilterFunctionCode,
      search: search,
      sortSetting: sortSetting,
    }
    return transformerExport
  }

  function importTransformer(p: TransformerExport | string): void {
    try {
      const transformerImport: TransformerExport =
        typeof p === "string" ? JSON.parse(p) : p
      // console.log(transformerExport)

      setTransformers(transformerImport.transformers || [])
      if (transformerImport.filterFunction) {
        setFilterFunctionCode(transformerImport.filterFunction)
        setAppliedFilterFunctionCode(transformerImport.filterFunction)
      }
      setFilters(validateFiltersImport(transformerImport.filters))
      setSearch(transformerImport.search || "")
      setHiddenColumns(transformerImport.hiddenColumns || [])
      setSortSetting(transformerImport.sortSetting || null)

      toast({
        title: "Transformer applied",
        // description: data.length + " lines",
        variant: "success",
      })
    } catch (error) {
      // Most probably incomplete/corrupted URL data
      console.error(error)
      toast({
        title: "Transformer import failed",
        variant: "error",
      })
    }
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
                cast: { boolean: (v) => String(v) },
              }),
            ]),
            fileName,
          )
          toast({
            title: "CSV exported",
            variant: "success",
          })
          trackEvent("Export", "CSV")
        },
      },
      {
        text: "Export as XLSX",
        icon: <ArchiveBoxArrowDownIconSolid />,
        onSelect: () => {
          const fileName = getExportFileName("xlsx")
          const workbook = XLSX.utils.book_new()
          const worksheet = XLSX.utils.aoa_to_sheet(getExportData())
          XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            cleanWorksheetName(fileName),
          )
          XLSX.writeFile(workbook, fileName, {
            bookType: "xlsx",
            compression: true,
          })
          toast({
            title: "XLSX exported",
            variant: "success",
          })
          trackEvent("Export", "XLSX")
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
          toast({
            title: "JSON exported",
            variant: "success",
          })
          trackEvent("Export", "JSON")
        },
      },
    ],
    [
      {
        text: "Copy as TSV",
        icon: <ClipboardDocumentCheckIcon />,
        onSelect: async () => {
          navigator.clipboard.writeText(
            stringifyCSV(getExportData(), {
              delimiter: "\t",
              cast: { boolean: (v) => String(v) },
            }),
          )
          toast({
            title: "TSV copied to clipboard",
            variant: "success",
          })
          trackEvent("Export", "TSV")
        },
      },
      {
        text: "Copy as Markdown",
        icon: <ClipboardDocumentCheckIcon />,
        onSelect: async () => {
          await navigator.clipboard.writeText(
            stringifyMarkdownTable(getExportData()),
          )
          toast({
            title: "Markdown copied to clipboard",
            variant: "success",
          })
          trackEvent("Export", "Markdown")
        },
      },
    ],
    [
      {
        text: "Save Project (Data + Transformer)",
        icon: <ArchiveBoxArrowDownIconSolid />,
        onSelect: async () => {
          const fileName = getExportFileName("fg")
          const dataBlob = await compressString(
            JSON.stringify(exportProject()),
          ).then((_) => _.blob())
          await saveFile(dataBlob, fileName)
          toast({
            title: "Project exported",
            variant: "success",
          })
          trackEvent("Export", "Project")
        },
      },
      {
        text: "Save Transformer File",
        icon: <ArchiveBoxArrowDownIconSolid />,
        onSelect: async () => {
          const fileName = "Transformer - " + getExportFileName("fg.json")
          saveFile(
            new Blob([JSON.stringify(exportTransformer(), null, "\t")]),
            fileName,
          )
          toast({
            title: "Transformer file exported",
            variant: "success",
          })
          trackEvent("Export", "Transformer")
        },
      },
      {
        text: "Share Link",
        icon: <ShareIcon />,
        onSelect: async () => {
          const project = exportProject()

          const urlWithoutHash = window.location.href.split("#")[0]

          console.time("Compressing")
          const base64Data = await stringToBase64Gzipped(
            JSON.stringify(project),
          )
          // console.log(base64Data)
          console.timeEnd("Compressing")

          const newHash = `#p=${base64Data}`
          const targetUrl = urlWithoutHash + newHash
          await navigator.clipboard.writeText(targetUrl)
          toast({
            title: "Link copied to clipboard",
          })
        },
      },
    ],
  ]

  const clearFilterButton = isFiltered ? (
    <button
      title="Clear all filters"
      onPointerDown={() => {
        setFilters([])
        setSearch("")
        setFilterFunctionCode("")
        setAppliedFilterFunctionCode(null)
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
    <div
      ref={drop}
      className="h-screen p-2"
      // onDragEnter={handleDragEnter}
      // onDragOver={handleDragOver}
      // onDrop={handleDrop}
      onPaste={(e) => {
        // Do not want to replace current data in case of accidental paste
        if (!currentFile) {
          const contentAsText = e.clipboardData.getData("text")
          // console.log(contentAsText)
          parseText(contentAsText, "CLIPBOARD", true)
          trackEvent("File", "Paste")
        }
      }}
    >
      {(() => {
        switch (parsingState) {
          case "initial":
            return (
              <div>
                <h1 className="text-6xl text-gray-700 m-4">FileGlance</h1>
                <div className="text-2xl text-gray-500 m-4">{description}</div>
                <Link
                  href="/about"
                  className="text-xl text-gray-500 font-medium py-2 px-4 rounded-sm transition-colors duration-200 no-underline hover:text-blue-900 hover:underline"
                >
                  📖 Learn more ...
                </Link>
                <div className="flex flex-col items-center">
                  <FileChooser
                    handleFileSelected={handleFileSelected}
                    isDragging={dragging}
                  ></FileChooser>

                  <span className="text-3xl text-gray-500 hidden sm:block">
                    Just want to play around?
                  </span>

                  <button
                    onClick={(e) => {
                      setParsingState("parsing")
                      setTimeout(() => {
                        onGenerateSampleData(e.metaKey ? 133_700 : 1337)
                      }, 50)
                      trackEvent("Button", "GenerateSampleData")
                    }}
                    className="text-2xl hover:bg-gray-100 text-gray-600 font-medium py-2 px-4 rounded-sm transition-colors duration-200 cursor-pointer hidden sm:inline-block"
                  >
                    📂 Load sample data
                  </button>

                  <span className="text-xl text-gray-500 mt-8">
                    Found a bug? Feedback? Ideas?
                  </span>

                  <button
                    onClick={onClickFeedbackCta}
                    className="text-lg hover:bg-gray-100 text-gray-600 font-medium py-2 px-4 rounded-sm transition-colors duration-200 cursor-pointer"
                  >
                    ✉️ Let me know!
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
                  <div className="flex flex-row items-baseline">
                    <div className="max-w-prose">
                      <MiddleEllipsis>
                        <span className="text-2xl" title={currentFile?.name}>
                          {currentFile?.name || ""}{" "}
                        </span>
                      </MiddleEllipsis>
                    </div>
                    <span className="text-gray-500 text-sm ml-1.5">
                      {fileInfos.join(", ")}
                    </span>
                    <span>{clearFilterButton}</span>

                    <span className="flex flex-row items-center ml-3">
                      <Label
                        htmlFor="hasHeader"
                        className="mr-1 text-gray-500 text-sm"
                      >
                        Has Header
                      </Label>
                      <Switch
                        id="hasHeader"
                        data-testid={"switch-hasHeader"}
                        disabled={dataFormatAlwaysIncludesHeader || isFiltered}
                        checked={dataIncludesHeaderRow}
                        onCheckedChange={(checked) => {
                          const longestRowLength = maxBy(
                            allRows,
                            (d) => d.length,
                          )!.length
                          if (checked) {
                            // No header row -> With header row
                            const _headerRow = generateHeaderRow(
                              longestRowLength,
                              allRows.shift(),
                            )
                            setHeaderRow(_headerRow)
                            setAllRows(allRows)
                          } else {
                            // With header row -> no header row
                            const _headerRow =
                              generateHeaderRow(longestRowLength)
                            setHeaderRow(_headerRow)
                            setAllRows([headerRow, ...allRows])
                          }
                          setDataIncludesHeaderRow(checked)
                        }}
                      ></Switch>
                    </span>
                  </div>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={viewMode}
                    onValueChange={(val) => {
                      if (val)
                        setViewMode(val as "visual" | "datatable" | "freeQuery")
                    }}
                  >
                    <ToggleGroupItem
                      value="datatable"
                      title="Data Table View"
                      data-testid={"btnTableView"}
                    >
                      <div className="flex items-center justify-center px-2">
                        <TableIcon className="inline-block w-4 h-4" />
                        <span className="hidden 2xl:inline ml-2">Table</span>
                      </div>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="visual"
                      title="Visual View"
                      data-testid={"btnVisualView"}
                    >
                      <div className="flex items-center justify-center px-2">
                        <BarChart2 className="inline-block mx-1 w-4 h-4" />
                        <span className="hidden 2xl:inline ml-2">Visual</span>
                      </div>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="freeQuery"
                      title="Code Query View"
                      data-testid={"btnFreeQueryView"}
                    >
                      <div className="flex items-center justify-center px-2">
                        <Code2 className="inline-block mx-1 w-4 h-4" />
                        <span className="hidden 2xl:inline ml-2">Code</span>
                      </div>
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <div className="flex gap-1">
                    <input
                      type="search"
                      data-testid="searchInput"
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

                    <Button
                      data-testid={"btnFilter"}
                      title="Filter rows"
                      variant="ghost"
                      className="py-1 px-2"
                      style={{
                        height: "unset",
                      }}
                      onPointerDown={() => {
                        setFilterDialogOpen(true)
                      }}
                    >
                      {appliedFilterFunctionCode ? (
                        <FunnelIconSolid className="size-5" />
                      ) : (
                        <FunnelIcon className="size-5" />
                      )}
                      <span className="ml-1 hidden 2xl:inline">Filter</span>
                    </Button>
                    {filterDialogOpen && (
                      <FilterDialog
                        open={filterDialogOpen}
                        filterFunctionCode={filterFunctionCode}
                        columnValueCounts={columnInfos}
                        headerRow={displayedHeader}
                        displayedData={displayedDataFiltered}
                        onClose={() => {
                          setFilterDialogOpen(false)
                          // Make sure to always show current applied filter when re-opening first (last draft state can still be recovered from history if needed)
                          if (appliedFilterFunctionCode) {
                            setFilterFunctionCode(appliedFilterFunctionCode)
                          }
                        }}
                        onFilterCodeChange={(code: string) =>
                          setFilterFunctionCode(code)
                        }
                        onApply={(code) => {
                          setFilterDialogOpen(false)
                          setAppliedFilterFunctionCode(code)
                        }}
                      />
                    )}
                    <Button
                      data-testid={"btnExport"}
                      title="Export data"
                      variant="ghost"
                      className="py-1 px-2"
                      style={{
                        height: "unset",
                      }}
                      ref={exportButtonRef}
                      onPointerDown={() => {
                        setPopoverAnchorElement(exportButtonRef.current)
                      }}
                    >
                      <ArrowTopRightOnSquareIcon className="size-5" />
                      <span className="ml-1 hidden 2xl:inline">Export</span>
                    </Button>
                    <MenuPopover
                      id={"exportPopover"}
                      menuItems={exportPopoverEntries}
                      open={Boolean(popoverAnchorElement)}
                      anchorEl={popoverAnchorElement}
                      onClose={handlePopoverClose}
                      onSelect={() => setPopoverAnchorElement(null)}
                      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                    ></MenuPopover>
                  </div>
                </div>
                <div
                  className="flex flex-row h-[calc(100vh-60px)] overflow-clip"
                  style={{
                    opacity: calculationInProgress ? 0.7 : undefined,
                    transition: "opacity 0.3s ease",
                  }}
                  data-testid="DataContentWrapper"
                >
                  <ValuesInspector
                    columnValueCounts={columnInfos}
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

                  {viewMode === "visual" ? (
                    <VisualView
                      columnInfos={columnInfos}
                      hiddenColumns={hiddenColumns}
                      data={displayedDataFiltered}
                    />
                  ) : viewMode === "freeQuery" ? (
                    <FreeQuery
                      data={displayedDataFiltered}
                      headerRow={displayedHeader}
                    />
                  ) : (
                    <DataTable
                      key={currentFile?.name}
                      headerRow={displayedHeader}
                      rows={displayedDataFiltered}
                      columnInfos={columnInfos}
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
                        setTransformers([...transformers, e])
                        setFilters(
                          filters
                            .map((f) => {
                              if (
                                e.asNewColumn &&
                                f.columnIndex > e.columnIndex
                              ) {
                                return {
                                  ...f,
                                  columnIndex: f.columnIndex + 1,
                                }
                              } else {
                                return f
                              }
                            })
                            .filter(
                              (f) =>
                                !e.asNewColumn ||
                                f.columnIndex !== e.columnIndex,
                            ),
                        )
                        if (e.asNewColumn) {
                          setHiddenColumns(
                            hiddenColumns.map((i) =>
                              i > e.columnIndex ? i + 1 : i,
                            ),
                          )
                          setOpenAccordions(
                            openAccordions.map((i) =>
                              i > e.columnIndex ? i + 1 : i,
                            ),
                          )
                        }
                      }}
                    ></DataTable>
                  )}
                </div>
              </React.Fragment>
            )
        }
      })()}
    </div>
  )
}

// Support legacy format for downwards compatibility and simpler variant when create projects from other apps
function instanceOfColumnFilterSimple(
  object: any,
): object is ColumnFilterSimple {
  return "includedValues" in object
}

function validateFiltersImport(
  filterToImport?: null | ColumnFilter[] | ColumnFilterSimple[],
): ColumnFilter[] {
  return (filterToImport || []).map((f) => {
    if (instanceOfColumnFilterSimple(f)) {
      return {
        columnIndex: f.columnIndex,
        filterValues: f.includedValues.map((ic) => ({
          included: true,
          value: ic,
        })),
      } as ColumnFilter
    } else {
      return f
    }
  })
}

interface ProjectExport {
  v?: number
  data: string
  filters?: ColumnFilter[] | ColumnFilterSimple[]
  hiddenColumns?: number[]
  name?: string
  search?: string
  filterFunction?: string | null
  transformers?: Omit<Transformer, "transformer">[]
  sortSetting?: SortSetting | null
}

interface TransformerExport extends Omit<ProjectExport, "data" | "name"> {}
