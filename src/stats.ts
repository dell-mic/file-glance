// Pure, side-effect-free computation for the column-statistics and pivot-chart
// numbers. Extracted from the chart components so the arithmetic can be unit
// tested without rendering React/recharts, and so the bug fixes (no spread on
// large groups, no Infinity display on empty columns, single-bucket degenerate
// histogram, frequency-ordered grouped series, string-keyed sort) live in one
// auditable place.
//
// All functions here must adhere to the AGENTS.md "Coding conventions" rule:
// never spread a growably-sized array into a variadic call, and never recurse
// to a depth that tracks input size. Prefer iterative loops / reduce.

import { ColumnInfos, ColumnValues } from "./app/components/ValueInspector"

export type Aggregation = "Sum" | "Average" | "Max" | "Min" | "Count"
export type SortField = "None" | "X-Value" | "Y-Value"
export type SortOrder = "asc" | "desc"

// ---------------------------------------------------------------------------
// Numeric column statistics
// ---------------------------------------------------------------------------

export interface NumericStats {
  /** Number of non-NaN numeric cells in the filtered view (weighted by count). */
  count: number
  min: number | null
  max: number | null
  sum: number
  avg: number | null
  /** Standard "average of the two middle elements for even length" median. */
  median: number | null
  histogram: { name: string; count: number }[]
}

const NULL_NUMERIC_STATS: NumericStats = {
  count: 0,
  min: null,
  max: null,
  sum: 0,
  avg: null,
  median: null,
  histogram: [],
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v)
}

function formatBucketEdge(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

/**
 * Materialises (flattened, count-weighted) all numeric values from a column's
 * `ColumnValues`. Non-number / NaN values are skipped. Memory note: this is
 * size-of-filtered-rows total memory (n ≤ filteredRow count), so it is not
 * unbounded-double; but it still scales linearly. Worst case is a single
 * distinct value with the whole filtered view's rows, which is by construction
 * ≤ filteredRow count, so nothing pathological — but mean/median here could be
 * computed from count aggregates directly if needed (kept as-is for clarity).
 */
export function materializeNumericValues(
  columnValues: ColumnValues[],
): number[] {
  const out: number[] = []
  for (const cv of columnValues) {
    if (cv.valueCountFiltered <= 0) continue
    const n = cv.value
    if (!isFiniteNumber(n)) continue
    for (let i = 0; i < cv.valueCountFiltered; i++) out.push(n)
  }
  return out
}

export function computeNumericStats(columnInfo: ColumnInfos): NumericStats {
  const displayed = columnInfo.columnValues.filter(
    (v) => v.value !== null && v.valueCountFiltered > 0,
  )

  let min = Infinity
  let max = -Infinity
  let hasAny = false
  for (const cv of displayed) {
    const n = cv.value
    if (typeof n !== "number" || Number.isNaN(n)) continue
    hasAny = true
    if (n < min) min = n
    if (n > max) max = n
  }
  if (!hasAny) return NULL_NUMERIC_STATS

  const allNumbers = materializeNumericValues(displayed)
  if (allNumbers.length === 0) return NULL_NUMERIC_STATS

  let sum = 0
  for (const n of allNumbers) sum += n
  const avg = sum / allNumbers.length

  // Iterative min/max — no spread (overflow-safe for large single groups).
  let minAll = allNumbers[0]
  let maxAll = allNumbers[0]
  for (let i = 1; i < allNumbers.length; i++) {
    const n = allNumbers[i]
    if (n < minAll) minAll = n
    if (n > maxAll) maxAll = n
  }

  // Median via in-place sort copy. For very large input this is O(n log n)
  // memory + time; acceptable here since allNumbers ≤ filtered rows.
  const sorted = [...allNumbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2

  // Histogram
  const bucketCount = Math.min(displayed.length, 10)
  let barChartData: { name: string; count: number }[] = []
  if (bucketCount > 0) {
    const range = max - min
    // Degenerate single-distinct-value case → single bucket, no misleading
    // "v - v+1" spans.
    if (range === 0) {
      barChartData = [
        { name: `${formatBucketEdge(min)}`, count: allNumbers.length },
      ]
    } else {
      const bucketSize = range / bucketCount
      barChartData = Array.from({ length: bucketCount }, (_, i) => ({
        name: `${formatBucketEdge(min + i * bucketSize)} - ${formatBucketEdge(min + (i + 1) * bucketSize)}`,
        count: 0,
      }))
      for (const n of allNumbers) {
        let idx = Math.floor((n - min) / bucketSize)
        if (idx >= bucketCount) idx = bucketCount - 1 // pin max into last bucket
        if (idx < 0) idx = 0
        barChartData[idx].count++
      }
    }
  }

  return {
    count: allNumbers.length,
    min: minAll,
    max: maxAll,
    sum,
    avg,
    median,
    histogram: barChartData,
  }
}

// ---------------------------------------------------------------------------
// Category column chart data
// ---------------------------------------------------------------------------

export interface CategoryDatum {
  name: string
  value: number
  percentage: number
}

export interface CategoryChartData {
  data: CategoryDatum[]
  otherSum: number
  otherCount: number
  total: number
}

const DEFAULT_MAX_CHART_VALUES = 10

export function buildCategoryChartData(
  columnInfo: ColumnInfos,
  maxChartValues: number = DEFAULT_MAX_CHART_VALUES,
  groupOther: boolean = true,
): CategoryChartData {
  const displayedValues = columnInfo.columnValues.filter(
    (v) => v.valueCountFiltered > 0,
  )
  const sortedValues = [...displayedValues].sort(
    (a, b) => b.valueCountFiltered - a.valueCountFiltered,
  )
  const topValues = sortedValues.slice(0, maxChartValues)
  const otherValues = sortedValues.slice(maxChartValues)

  let otherSum = 0
  for (const v of otherValues) otherSum += v.valueCountFiltered

  let base: { name: string; value: number }[]
  if (groupOther && otherValues.length >= 2) {
    base = [
      ...topValues.map((cv) => ({
        name: cv.valueName,
        value: cv.valueCountFiltered,
      })),
      { name: "Other", value: otherSum },
    ]
  } else {
    base = [
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

  let total = 0
  for (const d of base) total += d.value

  const data: CategoryDatum[] = base.map((d) => ({
    ...d,
    percentage: total > 0 ? (d.value / total) * 100 : 0,
  }))

  return {
    data,
    otherSum,
    otherCount: otherValues.length,
    total,
  }
}

// ---------------------------------------------------------------------------
// Pivot chart aggregation
// ---------------------------------------------------------------------------

export interface PivotAggregationResult {
  /** One object per xField group: { [xField]: xKey, [yField]: aggregatedValue } */
  chartData: Record<string, any>[]
}

/**
 * Aggregate `data` (array-of-rows indexed by columnIndex) grouping by xField,
 * applying `aggregation` over yField's values. Null/undefined/"" rows on
 * either axis are skipped. BigInt y values are downcast to Number (matches
 * the prior behaviour; the UI warns about this).
 *
 * Max/Min are computed iteratively — never via spread — to avoid
 * `RangeError: Maximum call stack size exceeded` on large single groups.
 */
export function aggregatePivot(
  rows: any[][],
  xIndex: number,
  yIndex: number,
  xFieldName: string,
  yFieldName: string,
  aggregation: Aggregation,
): PivotAggregationResult {
  const groups: Record<string, any[]> = {}
  for (const row of rows) {
    const _row =
      typeof row[yIndex] === "bigint"
        ? row.map((v) => (typeof v === "bigint" ? Number(v) : v))
        : row
    const x = _row[xIndex]
    const yRaw = _row[yIndex]
    if (x == null || x === "" || x === undefined) continue
    if (yRaw == null || yRaw === "" || yRaw === undefined) continue
    const key = String(x)
    let bucket = groups[key]
    if (!bucket) {
      bucket = []
      groups[key] = bucket
    }
    bucket.push(yRaw)
  }

  const chartData: Record<string, any>[] = []
  for (const [key, values] of Object.entries(groups)) {
    let val: number
    switch (aggregation) {
      case "Count":
        val = values.length
        break
      case "Sum": {
        let s = 0
        for (const v of values) s += Number(v)
        val = s
        break
      }
      case "Average": {
        let s = 0
        for (const v of values) s += Number(v)
        val = s / values.length
        break
      }
      case "Max": {
        // Iterative — overflow-safe for large groups (no Math.max(...values)).
        let m = Number(values[0])
        for (let i = 1; i < values.length; i++) {
          const n = Number(values[i])
          if (n > m) m = n
        }
        val = m
        break
      }
      case "Min": {
        let m = Number(values[0])
        for (let i = 1; i < values.length; i++) {
          const n = Number(values[i])
          if (n < m) m = n
        }
        val = m
        break
      }
    }
    chartData.push({ [xFieldName]: key, [yFieldName]: val })
  }
  return { chartData }
}

// ---------------------------------------------------------------------------
// Grouped (non-numeric y) bar chart — 2D contingency table
// ---------------------------------------------------------------------------

export interface GroupedBarData {
  chartData: Record<string, any>[]
  groupedYValues: any[]
}

/** Sort y series by descending total count so the most frequent groups come
 * first — fixes the previous bug where high-cardinality-but-rare y values
 * pushed the popular series past the MaxGroupsDisplayed cutoff. */
export function buildGroupedBarData(
  rows: any[][],
  xAccessor: (row: any[]) => any,
  yAccessor: (row: any[]) => any,
  xFieldName: string,
): GroupedBarData {
  // y value -> total count across all x
  const yTotalCounts: Map<any, number> = new Map()
  const yValuesSet = new Set<any>()
  for (const row of rows) {
    const yVal = yAccessor(row)
    if (yVal === undefined || yVal === null || yVal === "") continue
    yValuesSet.add(yVal)
    yTotalCounts.set(yVal, (yTotalCounts.get(yVal) ?? 0) + 1)
  }

  // Frequency-ordered (desc) y series: largest groups first → retained when
  // the renderer slices to MaxGroupsDisplayed.
  const yValues = Array.from(yValuesSet).sort((a, b) => {
    const ca = yTotalCounts.get(a) ?? 0
    const cb = yTotalCounts.get(b) ?? 0
    if (cb !== ca) return cb - ca
    // Stable tiebreak on string form for determinism.
    return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
  })

  const xGroups: Record<string, Record<string, number>> = {}
  for (const row of rows) {
    const x = xAccessor(row)
    const y = yAccessor(row)
    if (x == null || x === "" || x === undefined) continue
    if (y == null || y === "" || y === undefined) continue
    const xKey = String(x)
    const yKey = String(y)
    let bucket = xGroups[xKey]
    if (!bucket) {
      bucket = {}
      xGroups[xKey] = bucket
    }
    bucket[yKey] = (bucket[yKey] ?? 0) + 1
  }

  const chartData = Object.entries(xGroups).map(([xKey, yCounts]) => {
    const obj: Record<string, any> = { [xFieldName]: xKey }
    for (const yVal of yValues) {
      obj[String(yVal)] = yCounts[String(yVal)] ?? 0
    }
    return obj
  })

  return { chartData, groupedYValues: yValues }
}

// ---------------------------------------------------------------------------
// Sorting (fix for B1: Number(key) wrapping a column-name string → NaN)
// ---------------------------------------------------------------------------

// Sort the aggregated result by either xField or yField. Passes the property
// NAME as a string iteratee (previously wrapped in Number(...) → NaN iteratee
// → no sorting for any non-numeric column name).

export function sortPivotResult(
  result: Record<string, any>[],
  sortField: SortField,
  sortOrder: SortOrder,
  xFieldName: string,
  yFieldName: string,
  ySeriesFirstKey?: string,
): Record<string, any>[] {
  if (sortField === "None") return result
  // Pass the property NAME as a string iteratee (lodash resolves it as an
  // object path). Previously this was wrapped in Number(...) which produced
  // NaN and broke sorting for any non-numeric column name.
  const key =
    sortField === "X-Value"
      ? xFieldName
      : ySeriesFirstKey != null
        ? ySeriesFirstKey
        : yFieldName
  // Avoid heavyweight lodash import here — simple comparator keeps this pure
  // and dependency-free for unit testing.
  const dir = sortOrder === "asc" ? 1 : -1
  return [...result].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av === bv) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return av < bv ? -dir : dir
  })
}
