import React from "react"
import { ChartContainer } from "../../../components/ui/chart"
import { BarChart, Bar, Tooltip as RechartsTooltip } from "recharts"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../../components/ui/card"
import { ColumnInfos } from "../ValueInspector"
import { CHART_SERIES_COLORS, ChartAnimationDuration } from "./chartUtils"

interface NumericColumnChartProps {
  columnInfo: ColumnInfos
}

export const NumericColumnChart: React.FC<NumericColumnChartProps> = ({
  columnInfo: col,
}) => {
  const displayedValues = col.columnValues.filter(
    (v) => v.valueCountFiltered > 0,
  )
  let barChartData: { name: string; count: number }[] = []

  let min = Infinity,
    max = -Infinity
  for (const cv of displayedValues) {
    const n = cv.value
    if (!isNaN(n)) {
      if (n < min) min = n
      if (n > max) max = n
    }
  }

  const allNumbers: number[] = col.columnValues.flatMap((cv) => {
    const n = cv.value
    if (isNaN(n)) return []
    return Array(cv.valueCountFiltered).fill(n)
  })
  if (allNumbers.length > 0) {
    const bucketCount = Math.min(displayedValues.length, 10)
    const bucketSize = (max - min) / bucketCount || 1
    barChartData = Array.from({ length: bucketCount }, (_, i) => ({
      name: `${(min + i * bucketSize).toLocaleString(undefined, { maximumFractionDigits: 1 })} - ${(min + (i + 1) * bucketSize).toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
      count: 0,
    }))
    allNumbers.forEach((n) => {
      let idx = Math.floor((n - min) / bucketSize)
      if (idx >= bucketCount) idx = bucketCount - 1
      barChartData[idx].count++
    })
  }
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="items-center pb-0">
        <CardTitle>{col.columnName}</CardTitle>
        <CardDescription>
          {col.columnValues.length.toLocaleString()} distinct values
          {displayedValues.length !== col.columnValues.length && (
            <>, {displayedValues.length.toLocaleString()} filtered</>
          )}
          <div className="flex gap-3 mt-2 justify-center items-center">
            <span>
              Min:{" "}
              <b>
                {min.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </b>
            </span>
            <span>
              Max:{" "}
              <b>
                {max.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </b>
            </span>
          </div>
          {(() => {
            if (allNumbers.length === 0) return null
            const sum = allNumbers.reduce((a, b) => a + b, 0)
            const avg = sum / allNumbers.length
            const sorted = [...allNumbers].sort((a, b) => a - b)
            const mid = Math.floor(sorted.length / 2)
            const median =
              sorted.length % 2 !== 0
                ? sorted[mid]
                : (sorted[mid - 1] + sorted[mid]) / 2
            return (
              <div className="flex gap-3 mt-1 justify-center items-center">
                <span>
                  Avg:{" "}
                  <b>
                    {avg.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}
                  </b>
                </span>
                <span>
                  Median:{" "}
                  <b>
                    {median.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{" "}
                  </b>
                </span>
                <span>
                  Sum:{" "}
                  <b>
                    {sum.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{" "}
                  </b>
                </span>
              </div>
            )
          })()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 w-full pb-0">
        <ChartContainer config={{}} className="w-full h-full">
          <BarChart
            data={barChartData}
            margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
          >
            <RechartsTooltip
              labelFormatter={(label, props) => {
                const name = props[0]?.payload.name
                if (name) {
                  return `Bucket ${Number(label) + 1}: ${name}`
                }
              }}
              formatter={(value: number, name: string, props: any) => [
                <b key={props.payload.name} className="text-sm">
                  {value.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}
                </b>,
                null,
              ]}
            />
            <Bar
              dataKey="count"
              fill={CHART_SERIES_COLORS[0]}
              label={false}
              animationDuration={ChartAnimationDuration}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="text-muted-foreground leading-none">
          Showing distribution in {barChartData.length} linear buckets
        </div>
      </CardFooter>
    </Card>
  )
}
