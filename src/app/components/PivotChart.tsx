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
import React, { useMemo, useState, useRef } from "react"
import {
  aggregatePivot,
  buildGroupedBarData,
  sortPivotResult,
  type Aggregation,
  type SortField,
  type SortOrder,
} from "@/stats"
import {
  BarChart as BarIcon,
  LineChart as LineIcon,
  PieChart as PieIcon,
} from "lucide-react"
import {
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
  Download,
  AlertTriangle,
} from "lucide-react"
import domtoimage from "dom-to-image"
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
} from "recharts"
import {
  CHART_SERIES_COLORS,
  CHART_LABELS_COLORS,
  EMPTY_LABEL,
} from "./DataChart/chartUtils"

import { ColumnInfos } from "./ValueInspector"
import {
  saveFile,
  cleanForFileName,
  isNumericColumn as fnIsNumericColumn,
} from "../../utils"
import { MenuPopover } from "../../components/ui/Popover"
import { Button } from "../../components/ui/button"

interface PivotChartProps {
  columnInfos: ColumnInfos[]
  data: any[][]
}

const AGGREGATIONS = ["Sum", "Average", "Max", "Min", "Count"] as const
const CHART_TYPES = ["Bar", "Line", "Pie"] as const
const SORT_FIELDS = ["None", "X-Value", "Y-Value"] as const

const ChartElementId = "pivotChartArea"

const MaxGroupsDisplayed = 50

export const PivotChart: React.FC<PivotChartProps> = ({
  columnInfos,
  data,
}) => {
  const exportButtonRef = useRef<HTMLButtonElement>(null)
  const [popoverAnchorElement, setPopoverAnchorElement] =
    useState<HTMLElement | null>(null)
  const numericColumns = useMemo(
    () => columnInfos.filter((c) => fnIsNumericColumn(c)),
    [columnInfos],
  )
  // const noNumericColumns = numericColumns.length === 0

  // Helper to pick a good initial xField value
  function pickInitialXField(cols: ColumnInfos[]): string {
    const preferredNames = [
      "country",
      "region",
      "city",
      "state",
      "province",
      "department",
      "category",
      "type",
      "group",
      "sector",
      "year",
      "month",
      "quarter",
      "product",
      "item",
      "sku",
      "customer",
      "user",
      "client",
      "status",
      "stage",
      "sex",
    ]
    for (const name of preferredNames) {
      const found = cols.find((c) => c.columnName.toLowerCase() === name)
      if (found) return found.columnName
    }
    const stringCol = cols.find((c) => c.columnType === "String")
    if (stringCol) return stringCol.columnName
    return cols[0]?.columnName || ""
  }

  const [xField, setXField] = useState(() => pickInitialXField(columnInfos))
  const [yField, setYField] = useState(
    numericColumns[0]?.columnName || columnInfos[0].columnName || "",
  )
  const [aggregation, setAggregation] = useState<Aggregation>("Count")
  const [chartType, setChartType] =
    useState<(typeof CHART_TYPES)[number]>("Bar")
  const [sortField, setSortField] = useState<SortField>("Y-Value")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const isNumericColumn = !!numericColumns.find(
    (nc) => nc.columnName === yField,
  )

  // Prepare chart data
  const { chartData, _groupedYValues } = useMemo(() => {
    if (!xField || !yField) return { chartData: [], _groupedYValues: [] }

    // Grouped bar logic: if Bar chart and yField is not numeric, count per combination
    if (chartType === "Bar" && !isNumericColumn) {
      const { chartData, groupedYValues } = buildGroupedBarData(
        data,
        (row) => row[xField as keyof typeof row],
        (row) => row[yField as keyof typeof row],
        xField,
      )
      // Y series is frequency-ordered (largest first) so the renderer's slice to
      // MaxGroupsDisplayed keeps the most frequent series. For sort-by-Y-Value,
      // sort by the first (most frequent) series key.
      const firstYKey =
        groupedYValues.length > 0 ? String(groupedYValues[0]) : undefined
      const result = sortPivotResult(
        chartData,
        sortField,
        sortOrder,
        xField,
        yField,
        firstYKey,
      )
      return { chartData: result, _groupedYValues: groupedYValues }
    } else {
      const xIndex = columnInfos.find(
        (ci) => ci.columnName === xField,
      )!.columnIndex
      const yIndex = columnInfos.find(
        (ci) => ci.columnName === yField,
      )!.columnIndex
      const { chartData: aggData } = aggregatePivot(
        data,
        xIndex,
        yIndex,
        xField,
        yField,
        aggregation,
      )
      const result = sortPivotResult(
        aggData,
        sortField,
        sortOrder,
        xField,
        yField,
      )
      return { chartData: result }
    }
  }, [
    xField,
    yField,
    chartType,
    isNumericColumn,
    sortField,
    data,
    sortOrder,
    aggregation,
    columnInfos,
  ])

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

  const chartTitle = `${aggregation} of ${yField} by ${xField}`

  const handleExport = async (type: "png" | "svg") => {
    const chartNode = document.getElementById(ChartElementId)
    if (!chartNode) return
    try {
      if (type === "png") {
        const dataUrl = await domtoimage.toPng(chartNode)
        if (typeof dataUrl === "string") {
          const blob = await (await fetch(dataUrl)).blob()
          const fileName = cleanForFileName(chartTitle) + ".png"
          await saveFile(blob, fileName)
        }
      } else if (type === "svg") {
        // XMLSerializer for SVG export reduced much smaller (6kb vs 1.5 MB) results than domtoimage, however, e.g. does not embedd font, thus results are not the same as what is rendered in browser
        const chartSVG = chartNode.querySelector("svg")
        if (chartSVG) {
          const svgURL = new XMLSerializer().serializeToString(chartSVG)
          const svgBlob = new Blob([svgURL], {
            type: "image/svg+xml;charset=utf-8",
          })
          const fileName = cleanForFileName(chartTitle) + ".svg"
          await saveFile(svgBlob, fileName)
        }
      }
    } catch (err) {
      alert("Failed to export chart: " + err)
    }
  }

  const exportPopoverEntries = [
    [
      {
        text: "Export as PNG",
        icon: <Download className="size-5" />,
        onSelect: () => handleExport("png"),
      },
      {
        text: "Export as SVG",
        icon: <Download className="size-5" />,
        onSelect: () => handleExport("svg"),
      },
    ],
  ]

  const yColumnInfo = columnInfos.find((ci) => ci.columnName === yField)
  const yAxisIsNonNumeric = yColumnInfo && !fnIsNumericColumn(yColumnInfo)

  return (
    <Card className="flex flex-row gap-0 py-0 overflow-hidden">
      {/* Left controls column */}
      <CardContent className="min-w-80 max-w-80 p-4 bg-gray-100 border-r border-gray-300 flex flex-col gap-4">
        <CardHeader className="flex justify-center items-center">
          <CardTitle>Chart Settings</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="font-medium text-xs mb-1">X-Axis Field</Label>
            <Select value={xField} onValueChange={setXField}>
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
              onValueChange={(newVal) => {
                if (
                  !fnIsNumericColumn(
                    columnInfos.find((ci) => ci.columnName === newVal)!,
                  )
                ) {
                  setAggregation("Count")
                }
                setYField(newVal)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Y-Axis Field" />
              </SelectTrigger>
              <SelectContent>
                {columnInfos.map((col) => (
                  <SelectItem key={col.columnName} value={col.columnName}>
                    {col.columnName}{" "}
                    <span className="text-gray-500 text-xs">
                      ({col.columnType})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {yColumnInfo?.columnType === "BigInt" && (
              <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  BigInt is not fully supported and will be downcast to Number
                </span>
              </div>
            )}
          </div>
          <div>
            <Label className="font-medium text-xs mb-1">
              Aggregation Method
            </Label>
            <Select
              value={aggregation}
              onValueChange={(val) => setAggregation(val as Aggregation)}
              disabled={yAxisIsNonNumeric}
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
              disabled={yAxisIsNonNumeric}
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
          <div className="w-full">
            <Label className="font-medium text-xs mb-1">Sort Settings</Label>
            <div className="flex flex-row gap-2">
              <Select
                value={sortField}
                onValueChange={(val) => setSortField(val as SortField)}
              >
                <SelectTrigger className="w-1/2">
                  <SelectValue placeholder="Sort Field" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_FIELDS.map((field) => {
                    let label = field
                    if (field === "X-Value") label += ` (${xField})`
                    if (field === "Y-Value") label += ` (${yField})`
                    return (
                      <SelectItem key={field} value={field}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Select
                value={sortOrder}
                onValueChange={(val) => setSortOrder(val as SortOrder)}
                disabled={sortField === "None"}
              >
                <SelectTrigger className="w-1/2">
                  <SelectValue placeholder="Sort Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">
                    <span className="flex items-center gap-2">
                      <ArrowUpNarrowWide size={20} />
                      <span>Ascending</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="desc">
                    <span className="flex items-center gap-2">
                      <ArrowDownNarrowWide size={20} />
                      <span>Descending</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
      {/* Right chart area */}
      <CardContent className="flex-1 flex flex-col items-center justify-center px-2 relative">
        <div className="absolute top-2 right-2 z-10">
          <Button
            ref={exportButtonRef}
            variant="ghost"
            size="sm"
            title="Download chart"
            disabled={!xField || !yField}
            onPointerDown={() =>
              setPopoverAnchorElement(exportButtonRef.current)
            }
          >
            <Download className="size-5 mr-2" />
            Download chart
          </Button>
          <MenuPopover
            id="exportChartPopover"
            menuItems={exportPopoverEntries}
            open={Boolean(popoverAnchorElement)}
            anchorEl={popoverAnchorElement}
            onClose={() => setPopoverAnchorElement(null)}
            onSelect={() => setPopoverAnchorElement(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          />
        </div>

        <div className="w-full text-center my-4">
          <span className="text-xl">{chartTitle}</span>
        </div>
        {columnInfos.length < 2 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center text-gray-500">
            <div className="text-lg font-semibold mb-2">
              Not enough columns found
            </div>
            <div className="max-w-md">
              At least two columns is required to render a chart.
            </div>
          </div>
        ) : (
          <div id={ChartElementId} className="w-full">
            <ChartContainer config={chartConfig} className="w-full">
              {chartType === "Bar" ? (
                // Grouped bar chart if yField is not numeric
                !isNumericColumn ? (
                  (() => {
                    return (
                      <BarChart
                        data={chartData}
                        margin={{ top: 16, right: 16, left: 16, bottom: 16 }}
                      >
                        <XAxis dataKey={xField} />
                        <YAxis />
                        <Tooltip
                          formatter={(value: any, name: any) => [value, name]}
                        />
                        {/* One <Bar> per yField value */}
                        {_groupedYValues!
                          .slice(0, MaxGroupsDisplayed)
                          .map((yVal: any, i: number) => {
                            // const hasData = chartData.find(cd => cd.some(d => d[xField] === ))
                            return (
                              <Bar
                                key={String(yVal)}
                                dataKey={String(yVal)}
                                name={String(yVal)}
                                // hide={}
                                fill={
                                  CHART_SERIES_COLORS[
                                    i % CHART_SERIES_COLORS.length
                                  ]
                                }
                              />
                            )
                          })}
                      </BarChart>
                    )
                  })()
                ) : (
                  <BarChart
                    data={chartData}
                    margin={{ top: 16, right: 16, left: 16, bottom: 16 }}
                  >
                    <XAxis dataKey={xField} />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any) => [
                        value.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        }),
                        `${aggregation} of ${yField}`,
                      ]}
                    />
                    {/* <Legend formatter={() => `${aggregation} of ${yField}`} /> */}
                    <Bar dataKey={yField}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={
                            CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                )
              ) : chartType === "Line" ? (
                <LineChart
                  data={chartData}
                  margin={{ top: 16, right: 24, left: 16, bottom: 16 }}
                >
                  <XAxis dataKey={xField} />
                  <YAxis />
                  <Tooltip
                    formatter={(value: any) => [
                      value.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      }),
                      `${aggregation} of ${yField}`,
                    ]}
                  />
                  {/* <Legend formatter={() => `${aggregation} of ${yField}`} /> */}
                  <Line
                    type="monotone"
                    dataKey={yField}
                    stroke={CHART_SERIES_COLORS[0]}
                    strokeWidth={3}
                    dot
                  />
                </LineChart>
              ) : chartType === "Pie" ? (
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={"75%"}
                    labelLine={(props: any) => {
                      // TODO: Duplicate code froM CategoryColumnChart
                      const { index, points } = props
                      if (points && points.length === 2) {
                        const color =
                          CHART_SERIES_COLORS[
                            index % CHART_SERIES_COLORS.length
                          ]
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
                      const { name, index, cx, cy, midAngle, outerRadius } =
                        props
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
                        fill={
                          CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              ) : (
                <div />
              )}
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
