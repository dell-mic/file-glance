import * as React from "react"
import { ChartContainer, ChartTooltip } from "../../components/ui/chart"
import { PieChart, Pie, Cell } from "recharts"
import { ColumnInfos } from "./ValueInspector"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card"

interface DataChartsProps {
  columnValueCounts: ColumnInfos[]
  hiddenColumns: number[]
}

const MAX_CHART_VALUES = 10
const CSS_COLORS = [
  "#7eb0d5",
  "#b2e061",
  "#bd7ebe",
  "#ffb55a",
  "#ffee65",
  "#beb9db",
  "#fdcce5",
  "#8bd3c7",
  "#fd7f6f",
]

const OTHERS_COLOR = "#e5e7eb" // Tailwind gray-200
const groupOtherValues = true

export const DataCharts: React.FC<DataChartsProps> = ({
  columnValueCounts,
  hiddenColumns = [],
}) => {
  if (!Array.isArray(columnValueCounts)) return null
  return (
    <div
      className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3 pl-2 w-full overflow-y-scroll"
      style={{ scrollbarWidth: "thin" }}
    >
      {columnValueCounts.map((col, idx) => {
        if (!col || !col.columnName || !Array.isArray(col.columnValues))
          return null
        if (hiddenColumns.includes(col.columnIndex)) return null

        const displayedValues = col.columnValues.filter(
          (v) => v.valueCountFiltered > 0,
        )
        // Sort values descending by count
        const sortedValues = [...displayedValues].sort(
          (a, b) => b.valueCountFiltered - a.valueCountFiltered,
        )
        // Take top MAX_CHART_VALUES, sum the rest as 'Other' if groupOtherValues is true
        const topValues = sortedValues.slice(0, MAX_CHART_VALUES)
        const otherValues = sortedValues.slice(MAX_CHART_VALUES)
        let otherSum = 0
        let data = []
        if (groupOtherValues && otherValues.length >= 2) {
          otherSum = otherValues.reduce(
            (sum, v) => sum + v.valueCountFiltered,
            0,
          )
          data = [
            ...topValues.map((cv) => ({
              name: cv.valueName,
              value: cv.valueCountFiltered,
            })),
            { name: "Other", value: otherSum },
          ]
        } else {
          data = [
            ...topValues.map((cv) => ({
              name: cv.valueName,
              value: cv.valueCountFiltered,
            })),
            ...otherValues.map((cv) => ({
              name: cv.valueName,
              value: cv.valueCountFiltered,
            })),
          ]
        }

        // console.log(data)

        const chartConfig = Object.fromEntries(
          data.map((d, i) => [
            d.name,
            {
              label: d.name,
              color:
                d.name === "Other"
                  ? OTHERS_COLOR
                  : CSS_COLORS[i % CSS_COLORS.length],
            },
          ]),
        )
        // console.log(chartConfig)
        return (
          <Card key={col.columnName} className="flex flex-col w-full h-full">
            <CardHeader className="items-center pb-0">
              <CardTitle>{col.columnName}</CardTitle>
              <CardDescription>
                {col.columnValues.length} distinct values,{" "}
                {displayedValues.length} filtered
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 w-full pb-0">
              <ChartContainer
                config={chartConfig}
                className="w-full aspect-square"
              >
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    stroke="0"
                    startAngle={90}
                    endAngle={-270}
                    animationDuration={250}
                    label={false} // Hide labels
                  >
                    {data.map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={
                          entry.name === "Other"
                            ? OTHERS_COLOR
                            : CSS_COLORS[i % CSS_COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <ChartTooltip />
                  {/* <ChartLegend /> */}
                </PieChart>
              </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm">
              <div className="text-muted-foreground leading-none">
                {groupOtherValues && otherValues.length > 1 && (
                  <>
                    <span>
                      Note: grouped {otherValues.length} more values as{" "}
                      <span className="italic">Other</span>
                    </span>
                  </>
                )}
              </div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
