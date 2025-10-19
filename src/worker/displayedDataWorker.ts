import {
  ColumnFilter,
  compileTransformerCode,
  SortSetting,
  createRowProxy,
  Transformer,
  countValues,
  applyFilters,
} from "@/utils"
import { cloneDeep } from "lodash-es"

addEventListener(
  "message",
  async (event: MessageEvent<DisplayedDataWorkerInput>) => {
    //   console.log("event in worker", event)
    const {
      allRows,
      transformers,
      headerRow,
      filters,
      search,
      sortSetting,
      appliedFilterFunctionCode,
    } = event.data

    // console.log("DisplayedDataWorker received:", event.data)

    const _transformers: CompiledTransformer[] = transformers
      .map((t) => {
        const compilationResult = compileTransformerCode(
          t.transformerFunctionCode,
        )

        // Should be checked during input validation already, but can't be sure due to external import
        if (compilationResult.error) {
          console.error(compilationResult.error)
          return null
        }

        if (typeof compilationResult.transformer === "function") {
          return {
            ...t,
            transformer: compilationResult.transformer,
          } as CompiledTransformer
        }
        return null
      })
      .filter((t): t is CompiledTransformer => t !== null)

    const displayedHeader = getDisplayedHeader(headerRow, _transformers)

    // Allow access via headerName in subsequent code (esp. user functions)
    const _allRows = allRows.map((row) => createRowProxy(row, displayedHeader))

    const displayedData = applyTransformer(
      _allRows,
      _transformers,
      displayedHeader,
    )

    const displayedDataFiltered = applyFilters(
      displayedData,
      displayedHeader,
      filters,
      search,
      sortSetting,
      appliedFilterFunctionCode,
    ).map((_) => Array.from(_)) // Unwrap proxied data again, otherwise can't be cloned/transferred from worker thread

    const columnInfos = countValues(
      displayedHeader,
      displayedData,
      displayedDataFiltered,
    )

    postMessage({
      displayedHeader,
      // displayedData,
      displayedDataFiltered,
      columnInfos,
    })
  },
)

function applyTransformer(
  allRows: any[][],
  transformers: CompiledTransformer[],
  displayedHeader: string[],
) {
  console.time("applyTransformer")

  const transformedData = allRows

  // if (!transformers.length) {
  //   console.timeEnd("applyTransformer")
  //   return transformedData
  // }

  if (transformers.length) {
    for (const [rowIndex, row] of transformedData.entries()) {
      for (const columnIndex of row.keys()) {
        for (const transformer of transformers) {
          if (transformer.columnIndex === columnIndex) {
            let newValue
            try {
              newValue = transformer.transformer(
                row[columnIndex],
                columnIndex,
                rowIndex,
                displayedHeader[columnIndex],
                transformedData,
                allRows[rowIndex][columnIndex],
              )
            } catch (err: any) {
              console.error("Error while applying transformer:", err.toString())
              newValue = err.toString()
            }
            if (transformer.asNewColumn) {
              row.splice(columnIndex + 1, 0, newValue)
            } else {
              row[columnIndex] = newValue
            }
          }
        }
      }
    }
  }

  console.timeEnd("applyTransformer")
  return transformedData
}

function getDisplayedHeader(
  headerRow: string[],
  transformers: CompiledTransformer[],
) {
  const transformedHeaderRow = cloneDeep(headerRow)
  for (const transformer of transformers) {
    if (transformer.asNewColumn) {
      transformedHeaderRow.splice(
        transformer.columnIndex + 1,
        0,
        transformer.newColumnName ||
          headerRow[transformer.columnIndex] + "_NEW",
      )
    }
  }
  return transformedHeaderRow
}

export interface DisplayedDataWorkerInput {
  allRows: any[][]
  transformers: Transformer[]
  headerRow: string[]
  filters: ColumnFilter[]
  search: string
  sortSetting: SortSetting | null
  appliedFilterFunctionCode: string | null
}

interface CompiledTransformer extends Transformer {
  transformer: Function
}
