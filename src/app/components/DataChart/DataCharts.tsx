import * as React from "react"
import { NumericColumnChart } from "./NumericColumnChart"
import { CategoryColumnChart } from "./CategoryColumnChart"
import { ColumnInfos } from "../ValueInspector"
import { ChartCard } from "./ChartCard"

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
      className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5 gap-3 w-full overflow-y-scroll items-start"
      style={{ scrollbarWidth: "thin", gridAutoRows: "max-content" }}
    >
      {columnValueCounts.map((col) => {
        if (!col || !col.columnName || !Array.isArray(col.columnValues))
          return null
        if (hiddenColumns.includes(col.columnIndex)) return null
        const isNumberColumn = col.columnType === "Number"
        let chart = null
        if (isNumberColumn) {
          chart = <NumericColumnChart columnInfo={col} />
        } else {
          chart = <CategoryColumnChart columnInfo={col} />
        }
        return <ChartCard key={col.columnName}>{chart}</ChartCard>
      })}
    </div>
  )
}
