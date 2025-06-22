import * as React from "react"
import { NumericColumnChart } from "./NumericColumnChart"
import { CategoryColumnChart } from "./CategoryColumnChart"
import { ColumnInfos } from "../ValueInspector"

interface DataChartsProps {
  columnInfos: ColumnInfos[]
  hiddenColumns: number[]
}

export const DataCharts: React.FC<DataChartsProps> = ({
  columnInfos: columnValueCounts,
  hiddenColumns = [],
}) => {
  if (!Array.isArray(columnValueCounts)) return null
  return (
    <div
      className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-3 pl-2 w-full overflow-y-scroll items-start"
      style={{ scrollbarWidth: "thin", gridAutoRows: "max-content" }}
    >
      {columnValueCounts.map((col) => {
        if (!col || !col.columnName || !Array.isArray(col.columnValues))
          return null
        if (hiddenColumns.includes(col.columnIndex)) return null
        const isNumberColumn = col.columnType === "Number"
        if (isNumberColumn) {
          return <NumericColumnChart key={col.columnName} columnInfo={col} />
        } else {
          return <CategoryColumnChart key={col.columnName} columnInfo={col} />
        }
      })}
    </div>
  )
}
