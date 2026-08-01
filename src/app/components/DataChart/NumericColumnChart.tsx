import React from "react"
import { computeNumericStats } from "@/stats"
import { ChartContainer } from "../../../components/ui/chart"
import { BarChart, Bar, Tooltip as RechartsTooltip } from "recharts"
import {
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
  const allValues = col.columnValues.filter((v) => v.value !== null)
  const displayedValues = allValues.filter((v) => v.valueCountFiltered > 0)

  const stats = computeNumericStats(col)
  const barChartData = stats.histogram

  const fmt = (n: number | null) =>
    n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 1 })

  return (
    <>
      <CardHeader className="items-center pb-0">
        <CardTitle>{col.columnName}</CardTitle>
        <CardDescription>
          {allValues.length.toLocaleString()} distinct values
          {displayedValues.length !== allValues.length && (
            <>, {displayedValues.length.toLocaleString()} filtered</>
          )}
          <div className="flex gap-3 mt-2 justify-center items-center">
            <span>
              Min: <b>{fmt(stats.min)}</b>
            </span>
            <span>
              Max: <b>{fmt(stats.max)}</b>
            </span>
          </div>
          {(() => {
            // Hide Avg/Median/Sum when there are no numeric values (no ∞ etc.)
            if (stats.count === 0) return null
            return (
              <div className="flex gap-3 mt-1 justify-center items-center">
                <span>
                  Avg:{" "}
                  <b>
                    {stats.avg!.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}
                  </b>
                </span>
                <span>
                  Median:{" "}
                  <b>
                    {stats.median!.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{" "}
                  </b>
                </span>
                <span>
                  Sum:{" "}
                  <b>
                    {stats.sum.toLocaleString(undefined, {
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
              formatter={(value: any, name: any, item: any) => [
                <b key={item.payload.name} className="text-sm">
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
    </>
  )
}
