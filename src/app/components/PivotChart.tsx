import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "../../components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { ChartContainer } from "@/components/ui/chart"
import React, { useMemo, useState } from "react"
import {
  BarChart as BarIcon,
  LineChart as LineIcon,
  PieChart as PieIcon,
} from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts"
import {
  CHART_SERIES_COLORS,
  CHART_LABELS_COLORS,
  EMPTY_LABEL,
} from "./DataChart/chartUtils"

// Types for props
import { ColumnInfos } from "./ValueInspector"

interface PivotChartProps {
  columnInfos: ColumnInfos[]
  data: any[][]
}

const AGGREGATIONS = ["Sum", "Average", "Max", "Min", "Count"] as const
const CHART_TYPES = ["Bar", "Line", "Pie"] as const

export const PivotChart: React.FC<PivotChartProps> = ({
  columnInfos,
  data,
}) => {
  const numericColumns = useMemo(
    () => columnInfos.filter((c) => c.columnType === "Number"),
    [columnInfos],
  )
  const noNumericColumns = numericColumns.length === 0

  // Helper to pick a good initial xField value
  function pickInitialXField(cols: ColumnInfos[]): string {
    const preferredNames = ["country", "region", "city"]
    for (const name of preferredNames) {
      const found = cols.find((c) => c.columnName.toLowerCase() === name)
      if (found) return found.columnName
    }
    const stringCol = cols.find((c) => c.columnType === "String")
    if (stringCol) return stringCol.columnName
    return cols[0]?.columnName || ""
  }

  const [xField, setXField] = useState(() => pickInitialXField(columnInfos))
  const [yField, setYField] = useState(numericColumns[0]?.columnName || "")
  const [aggregation, setAggregation] =
    useState<(typeof AGGREGATIONS)[number]>("Sum")
  const [chartType, setChartType] =
    useState<(typeof CHART_TYPES)[number]>("Bar")

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!xField || !yField) return []
    // Group by xField
    const groups: Record<string, number[]> = {}
    for (const row of data) {
      const x = row[xField as keyof typeof row]
      const yRaw = row[yField as keyof typeof row]
      if (x == null || x === undefined || yRaw == null || yRaw === undefined)
        continue
      const y = Number(yRaw)
      if (isNaN(y)) continue
      if (!groups[x]) groups[x] = []
      groups[x].push(y)
    }
    // Aggregate
    return Object.entries(groups).map(([key, values]) => {
      let val = 0
      switch (aggregation) {
        case "Sum":
          val = values.reduce((a, b) => a + b, 0)
          break
        case "Average":
          val = values.reduce((a, b) => a + b, 0) / values.length
          break
        case "Max":
          val = Math.max(...values)
          break
        case "Min":
          val = Math.min(...values)
          break
        case "Count":
          val = values.length
          break
      }
      return { [xField]: key, [yField]: val }
    })
  }, [data, xField, yField, aggregation])

  const pieData = useMemo(() => {
    if (!xField || !yField) return []
    return chartData.map((d) => ({ name: d[xField], value: d[yField] }))
  }, [chartData, xField, yField])

  const chartConfig = useMemo(() => {
    return Object.fromEntries(
      pieData.map((d, i) => [
        d.name,
        {
          label: d.name,
          color: CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
        },
      ]),
    )
  }, [pieData])

  return (
    <Card className="flex flex-row gap-0 py-0 overflow-hidden">
      {/* Left controls column */}
      <CardContent className="min-w-80 max-w-80 p-4 bg-gray-100 border-r border-gray-300 flex flex-col gap-4">
        <CardHeader className="flex justify-center items-center">
          <CardTitle>Chart Settings</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label className="font-medium text-xs mb-1">X-Axis Field</Label>
            <Select
              value={xField}
              onValueChange={setXField}
              disabled={noNumericColumns}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="X-Axis Field" />
              </SelectTrigger>
              <SelectContent>
                {columnInfos
                  .filter((ci) => ci.columnValues.length > 1)
                  .map((col) => (
                    <SelectItem key={col.columnName} value={col.columnName}>
                      {col.columnName}{" "}
                      <span className="text-gray-500 text-xs">
                        ({col.columnType})
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-medium text-xs mb-1">Y-Axis Field</Label>
            <Select
              value={yField}
              onValueChange={setYField}
              disabled={noNumericColumns}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Y-Axis Field" />
              </SelectTrigger>
              <SelectContent>
                {numericColumns.map((col) => (
                  <SelectItem key={col.columnName} value={col.columnName}>
                    {col.columnName}{" "}
                    <span className="text-gray-500 text-xs">
                      ({col.columnType})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-medium text-xs mb-1">Aggregation</Label>
            <Select
              value={aggregation}
              onValueChange={(val) =>
                setAggregation(val as (typeof AGGREGATIONS)[number])
              }
              disabled={noNumericColumns}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Aggregation" />
              </SelectTrigger>
              <SelectContent>
                {AGGREGATIONS.map((agg) => (
                  <SelectItem key={agg} value={agg}>
                    {agg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-medium text-xs mb-1">Chart Type</Label>
            <Select
              value={chartType}
              onValueChange={(val) =>
                setChartType(val as (typeof CHART_TYPES)[number])
              }
              disabled={noNumericColumns}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chart Type" />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    <span className="flex items-center gap-2">
                      {type === "Bar" && <BarIcon size={20} />}
                      {type === "Line" && <LineIcon size={20} />}
                      {type === "Pie" && <PieIcon size={20} />}
                      <span>{type}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
      {/* Right chart area */}
      <CardContent className="flex-1 flex items-center justify-center p-4">
        {noNumericColumns ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center text-gray-500">
            <div className="text-lg font-semibold mb-2">
              No numeric columns found
            </div>
            <div className="max-w-md">
              At least one numeric column is required to render a chart.
              <br />
              <br />
              If your import format does not contain type information, you can
              use a transformer like <code>parseInt()</code> to convert values
              to numbers.
            </div>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="w-full">
            {chartType === "Bar" ? (
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 24, left: 24, bottom: 16 }}
              >
                <XAxis dataKey={xField} />
                <YAxis />
                <Tooltip
                  formatter={(value) => [
                    value.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    }),
                    `${aggregation} of ${yField}`,
                  ]}
                />
                <Legend formatter={() => `${aggregation} of ${yField}`} />
                <Bar dataKey={yField}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : chartType === "Line" ? (
              <LineChart
                data={chartData}
                margin={{ top: 16, right: 24, left: 24, bottom: 16 }}
              >
                <XAxis dataKey={xField} />
                <YAxis />
                <Tooltip
                  formatter={(value) => [
                    value.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    }),
                    `${aggregation} of ${yField}`,
                  ]}
                />
                <Legend formatter={() => `${aggregation} of ${yField}`} />
                <Line
                  type="monotone"
                  dataKey={yField}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            ) : chartType === "Pie" ? (
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={120}
                  labelLine={(props: any) => {
                    // TODO: Duplicate code froM CategoryColumnChart
                    const { index, points } = props
                    if (points && points.length === 2) {
                      const color =
                        CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length]
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
                    // TODO: Duplicate code froM CategoryColumnChart
                    const { name, index, cx, cy, midAngle, outerRadius } = props
                    const RADIAN = Math.PI / 180
                    const radius = outerRadius + 18
                    const x = cx + radius * Math.cos(-midAngle * RADIAN)
                    const y = cy + radius * Math.sin(-midAngle * RADIAN)
                    const color =
                      CHART_LABELS_COLORS[index % CHART_LABELS_COLORS.length]
                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor={x > cx ? "start" : "end"}
                        dominantBaseline="central"
                        style={{ fill: color }}
                      >
                        {name || EMPTY_LABEL}
                      </text>
                    )
                  }}
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : (
              <div />
            )}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
