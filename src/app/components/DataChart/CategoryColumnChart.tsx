import React from "react"
import "./CategoryColumnChart.css"
import { ChartContainer, ChartTooltip } from "../../../components/ui/chart"
import { PieChart, Pie, Cell } from "recharts"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../../components/ui/card"
import { ColumnInfos } from "../ValueInspector"
import {
  CHART_LABELS_COLORS,
  CHART_SERIES_COLORS,
  ChartAnimationDuration,
  darkenHexColor,
  EMPTY_LABEL,
} from "./chartUtils"

interface CategoryColumnChartProps {
  columnInfo: ColumnInfos
}

const MAX_CHART_VALUES = 10
const OTHERS_COLOR = "#E5E7EB"
const OTHERS_LABEL_COLOR = darkenHexColor(OTHERS_COLOR, 0.3) // Slight darker for better readability
const groupOtherValues = true
const MinSharePctForLabel = 2.5

export const CategoryColumnChart: React.FC<CategoryColumnChartProps> = ({
  columnInfo: col,
}) => {
  const displayedValues = col.columnValues.filter(
    (v) => v.valueCountFiltered > 0,
  )
  const sortedValues = [...displayedValues].sort(
    (a, b) => b.valueCountFiltered - a.valueCountFiltered,
  )
  const topValues = sortedValues.slice(0, MAX_CHART_VALUES)
  const otherValues = sortedValues.slice(MAX_CHART_VALUES)
  let otherSum = 0
  let data = []
  if (groupOtherValues && otherValues.length >= 2) {
    otherSum = otherValues.reduce((sum, v) => sum + v.valueCountFiltered, 0)
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
  const total = data.reduce((sum, d) => sum + d.value, 0)
  data = data.map((d) => ({
    ...d,
    percentage: total > 0 ? (d.value / total) * 100 : 0,
  }))

  // Show only for bigger values to avoid label overlap, at always at least one
  const showLabelFor = data.map((_, i) =>
    i === 0 ? true : _.percentage >= MinSharePctForLabel,
  )
  const chartConfig = Object.fromEntries(
    data.map((d, i) => [
      d.name,
      {
        label: d.name,
        color:
          d.name === "Other"
            ? OTHERS_COLOR
            : CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
      },
    ]),
  )
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="items-center pb-0">
        <CardTitle>{col.columnName}</CardTitle>
        <CardDescription>
          {col.columnValues.length} distinct values
          {displayedValues.length !== col.columnValues.length && (
            <>, {displayedValues.length} filtered</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 w-full pb-0 px-1">
        <ChartContainer
          config={chartConfig}
          className="w-full aspect-square overflow-hidden"
        >
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              stroke="0"
              overflow={"visible"}
              outerRadius="75%"
              startAngle={90}
              endAngle={-270}
              animationDuration={ChartAnimationDuration}
              animationBegin={0}
              labelLine={(props: any) => {
                const { index, points } = props
                if (showLabelFor[index] && points && points.length === 2) {
                  const color =
                    data[index].name === "Other"
                      ? OTHERS_COLOR
                      : CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length]
                  const [start, end] = points
                  const dx = end.x - start.x
                  const dy = end.y - start.y
                  const shorten = 8
                  const length = Math.sqrt(dx * dx + dy * dy)
                  const ratio = (length - shorten) / length
                  const shortEnd = {
                    x: start.x + dx * ratio,
                    y: start.y + dy * ratio,
                  }
                  return (
                    <path
                      d={`M${start.x},${start.y}L${shortEnd.x},${shortEnd.y}`}
                      stroke={color}
                      fill="none"
                    />
                  )
                }
                return <g style={{ display: "none" }} />
              }}
              label={(props: any) => {
                const { name, index, cx, cy, midAngle, outerRadius } = props
                if (!showLabelFor[index]) return null

                // return name

                const RADIAN = Math.PI / 180
                // Default recharts label position: just outside the arc
                const radius = outerRadius + 18
                const x = cx + radius * Math.cos(-midAngle * RADIAN)
                const y = cy + radius * Math.sin(-midAngle * RADIAN)
                const color =
                  data[index].name === "Other"
                    ? OTHERS_LABEL_COLOR
                    : CHART_LABELS_COLORS[index % CHART_LABELS_COLORS.length]
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor={x > cx ? "start" : "end"}
                    dominantBaseline="central"
                    style={{ fill: color, fontWeight: "" }}
                  >
                    {name || EMPTY_LABEL}
                  </text>
                )
              }}
            >
              {data.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={
                    entry.name === "Other"
                      ? OTHERS_COLOR
                      : CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]
                  }
                />
              ))}
            </Pie>
            <ChartTooltip
              formatter={(
                value: number,
                name: string,
                item: any,
                index: number,
                props: any,
              ) => {
                // console.log(props)
                const percent = props[0].payload?.payload?.percentage || 0

                return [
                  `${value} (${percent.toFixed(1)}%)`,
                  name || EMPTY_LABEL,
                ]
              }}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="text-muted-foreground leading-none">
          {groupOtherValues && otherValues.length > 1 && (
            <span>
              Note: grouped {otherValues.length} more values as{" "}
              <span className="italic">Other</span>
            </span>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
