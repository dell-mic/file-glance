import { test, expect, Page } from "@playwright/test"
import path from "path"

// Fixture: test/files/stats_sample.json
//   [{Category, Region, Sales(number), Flag(number=1)} × 6 rows]
//   A/North/10  A/South/20  B/North/30  B/South/40  C/North/50  C/South/60
//   (JSON numbers keep their Number type so NumericColumnChart renders —
//    CSV would parse everything to strings and force category pies.)
//
// Pivot defaults after fixture load:
//   xField = Region (preferred name "region"), yField = Sales (first numeric),
//   aggregation = Count, chartType = Bar, sort = Y-Value desc.
//
// Expected aggregated numbers (asserted via X-axis tick order, which reflects
// the desc-by-value sort):
//   Count   of Sales by Region: North=3 South=3 (tie → insertion: North, South)
//   Sum     of Sales by Region: North=90 South=120 (desc → South, North)
//   Average of Sales by Region: North=30 South=40 (desc → South, North)
//   Max     of Sales by Region: North=50 South=60 (desc → South, North)
//   Min     of Sales by Region: North=10 South=20 (desc → South, North)

const FILE = path.join(import.meta.dirname, "../files", "stats_sample.json")

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")
  await page.setViewportSize({ width: 1600, height: 1200 })
  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(FILE)
  await page.getByTestId("btnVisualView").click()
})

/** Opens the Radix Select whose control group is labeled `label`, picks `option`. */
async function pickSelectOption(page: Page, label: string, option: string) {
  // Structure: <div><label>{label}</label><button trigger/></div>
  const group = page.locator("label", { hasText: label }).locator("xpath=..")
  await group.locator("button").first().click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

/** X-axis tick value labels in DOM order (= data order, which follows the sort). */
async function xTickTexts(page: Page): Promise<string[]> {
  const texts = await page
    .locator(".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value")
    .allTextContents()
  return texts.map((t) => t.trim()).filter((t) => t.length > 0)
}

/** Scope to the stats card whose title is `columnName` (shadcn card with
 *  data-slot="card"; its title renders with data-slot="card-title"). */
function cardFor(page: Page, columnName: string) {
  return page
    .locator(`[data-slot="card-title"]`, { hasText: columnName })
    .locator('xpath=ancestor::*[@data-slot="card"][1]')
}

async function gotoPivot(page: Page) {
  await page.getByRole("tab", { name: "Pivot Chart" }).click()
}

// ---------------------------------------------------------------------------
// Column Statistics tab
// ---------------------------------------------------------------------------

test.describe("Column Statistics tab", () => {
  test("Numeric column renders exact min/max/avg/median/sum and histogram", async ({
    page,
  }) => {
    // Sales: 10,20,30,40,50,60 → distinct 6, min 10, max 60, sum 210,
    // avg 35, median (30+40)/2 = 35, 6 buckets.
    const card = cardFor(page, "Sales")
    await expect(card).toContainText("6 distinct values")
    await expect(card).toContainText("Min: 10")
    await expect(card).toContainText("Max: 60")
    await expect(card).toContainText("Avg: 35")
    await expect(card).toContainText("Median: 35")
    await expect(card).toContainText("Sum: 210")
    await expect(card).toContainText("Showing distribution in 6 linear buckets")
  })

  test("Numeric column with a single distinct value degenerates to one bucket (B5)", async ({
    page,
  }) => {
    // Flag: all rows = 1 → 1 distinct, range 0 → single bucket.
    const card = cardFor(page, "Flag")
    await expect(card).toContainText("1 distinct values")
    await expect(card).toContainText("Min: 1")
    await expect(card).toContainText("Max: 1")
    await expect(card).toContainText("Avg: 1")
    await expect(card).toContainText("Sum: 6")
    await expect(card).toContainText("Showing distribution in 1 linear buckets")
  })

  test("Category column shows distinct count and no Other grouping for few values", async ({
    page,
  }) => {
    const card = cardFor(page, "Category")
    await expect(card).toContainText("3 distinct values")
    await expect(card).not.toContainText("grouped")
  })

  test("Category column with 2 distinct values shows count and no Other note", async ({
    page,
  }) => {
    const card = cardFor(page, "Region")
    await expect(card).toContainText("2 distinct values")
    await expect(card).not.toContainText("grouped")
  })
})

// ---------------------------------------------------------------------------
// Pivot Chart tab — Bar (numeric single-series + grouped non-numeric y)
// ---------------------------------------------------------------------------

test.describe("Pivot Chart — Bar", () => {
  test("Count of Sales by Region renders 2 bars with tie-ordered ticks", async ({
    page,
  }) => {
    await gotoPivot(page)
    await expect(
      page.getByText("Count of Sales by Region", { exact: true }),
    ).toBeVisible()
    await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(2)
    // Count tie (3/3) → insertion order North, South
    expect(await xTickTexts(page)).toEqual(["North", "South"])
  })

  test("Sum of Sales by Region orders ticks by descending value", async ({
    page,
  }) => {
    await gotoPivot(page)
    await pickSelectOption(page, "Aggregation Method", "Sum")
    await expect(
      page.getByText("Sum of Sales by Region", { exact: true }),
    ).toBeVisible()
    await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(2)
    // South(120) > North(90) → desc → South, North
    expect(await xTickTexts(page)).toEqual(["South", "North"])
  })

  test("Grouped bar with a non-numeric y renders one bar per x×y combination", async ({
    page,
  }) => {
    await gotoPivot(page)
    // yField → Category (non-numeric) forces Count + grouped bar
    await pickSelectOption(page, "Y-Axis Field", "Category (String)")
    await expect(
      page.getByText("Count of Category by Region", { exact: true }),
    ).toBeVisible()
    // 3 y series (A,B,C) × 2 x groups (North,South) = 6 bar rectangles
    await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(6)
    expect(await xTickTexts(page)).toEqual(["North", "South"])
  })
})

// ---------------------------------------------------------------------------
// Pivot Chart tab — Line
// ---------------------------------------------------------------------------

test.describe("Pivot Chart — Line", () => {
  test("Average of Sales by Region renders 2 points ordered desc", async ({
    page,
  }) => {
    await gotoPivot(page)
    await pickSelectOption(page, "Chart Type", "Line")
    await pickSelectOption(page, "Aggregation Method", "Average")
    await expect(
      page.getByText("Average of Sales by Region", { exact: true }),
    ).toBeVisible()
    await expect(page.locator(".recharts-line-dot")).toHaveCount(2)
    // South(40) > North(30) → desc → South, North
    expect(await xTickTexts(page)).toEqual(["South", "North"])
  })

  test("Max of Sales by Region renders 2 points", async ({ page }) => {
    await gotoPivot(page)
    await pickSelectOption(page, "Chart Type", "Line")
    await pickSelectOption(page, "Aggregation Method", "Max")
    await expect(
      page.getByText("Max of Sales by Region", { exact: true }),
    ).toBeVisible()
    await expect(page.locator(".recharts-line-dot")).toHaveCount(2)
    expect(await xTickTexts(page)).toEqual(["South", "North"])
  })
})

// ---------------------------------------------------------------------------
// Pivot Chart tab — Pie
// ---------------------------------------------------------------------------

test.describe("Pivot Chart — Pie", () => {
  test("Max of Sales by Region renders 2 slices", async ({ page }) => {
    await gotoPivot(page)
    await pickSelectOption(page, "Chart Type", "Pie")
    await pickSelectOption(page, "Aggregation Method", "Max")
    await expect(
      page.getByText("Max of Sales by Region", { exact: true }),
    ).toBeVisible()
    // 1 slice per x group
    await expect(page.locator(".recharts-pie-sector")).toHaveCount(2)
  })

  test("Min of Sales by Region renders 2 slices", async ({ page }) => {
    await gotoPivot(page)
    await pickSelectOption(page, "Chart Type", "Pie")
    await pickSelectOption(page, "Aggregation Method", "Min")
    await expect(
      page.getByText("Min of Sales by Region", { exact: true }),
    ).toBeVisible()
    await expect(page.locator(".recharts-pie-sector")).toHaveCount(2)
  })
})
