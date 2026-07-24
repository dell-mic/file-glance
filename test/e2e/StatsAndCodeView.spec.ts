import { test, expect, Page } from "@playwright/test"
import path from "path"

// Fixture: sample.csv has 50 data rows.
// Country counts: USA 15, Canada 13, UK 11, Australia 11.
// Has Pet counts: Yes 24, No 26 (within USA rows: Yes 12, No 3).

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(import.meta.dirname, "../files", "sample.csv"),
  )
})

async function transformCountryToLowercase(page: Page) {
  await page.getByTestId("header_5_Country").click()
  await page.getByTestId("headerBtn_5_Country").click()
  await page.getByTestId("menuEntry-Transform").click()
  await page
    .getByTestId("transformCodeInput")
    .locator("textarea")
    .fill("return value.toLowerCase()")
  await page.getByTestId("btnTransformApply").click()
}

async function includeUsaRows(page: Page) {
  const countryInspector = page.getByTestId("valueInspector_5_Country")
  await countryInspector.click()
  // Wait for the worker to finish transforming before filtering:
  // the inspector must show the transformed (lowercase) values.
  await expect(countryInspector).toContainText("usa")
  await countryInspector.getByRole("link", { name: "usa", exact: true }).click()
  // Wait for the worker to finish filtering
  await expect(page.getByTestId("filterExplanationTrigger")).toHaveText(
    "15 filtered",
  )
}

function queryOutput(page: Page) {
  // The query output is rendered in a read-only Monaco editor
  return page.locator(".monaco-editor .view-lines")
}

async function runQueryAndExpect(
  page: Page,
  query: string,
  // Anchored pattern matching the full output; consecutive queries must
  // have different expected outputs so a stale previous output cannot match
  expected: RegExp,
  timeout?: number,
) {
  await page.getByPlaceholder(/\/\/ Example:/).fill(query)
  await page.getByTitle("Run Query (Ctrl/Cmd + Enter)").click()
  await expect(queryOutput(page)).toHaveText(
    expected,
    timeout ? { timeout } : undefined,
  )
}

test(`Statistics reflect transformed and filtered data`, async ({ page }) => {
  await transformCountryToLowercase(page)
  await includeUsaRows(page)

  // Top bar: filtered count and hover card explanation
  const trigger = page.getByTestId("filterExplanationTrigger")
  await expect(trigger).toHaveText("15 filtered")
  await trigger.hover()
  const card = page.getByTestId("filterExplanationCard")
  await expect(card).toBeVisible()
  await expect(card).toContainText("15 of 50 rows match (30%)")
  await expect(card).toContainText("Country = 'usa'")

  // Value inspector shows "filtered / total" counts per value,
  // computed from the transformed values
  const countryInspector = page.getByTestId("valueInspector_5_Country")
  await expect(countryInspector).toContainText("15 / 15") // usa
  await expect(countryInspector).toContainText("0 / 13") // canada
  await expect(countryInspector).toContainText("0 / 11") // uk & australia

  // Counts of other columns are filtered as well (USA rows: 12 Yes, 3 No)
  const hasPetInspector = page.getByTestId("valueInspector_15_Has Pet")
  await hasPetInspector.click()
  await expect(hasPetInspector).toContainText("12 / 24") // Yes
  await expect(hasPetInspector).toContainText("3 / 26") // No
})

test(`Code tab sees transformed and filtered data, accessible by index and proxied name`, async ({
  page,
}) => {
  await transformCountryToLowercase(page)
  await includeUsaRows(page)

  await page.getByTestId("btnFreeQueryView").click()

  // First output render loads the local Monaco chunk and boots its
  // workers: allow extra time.
  // (First USA row is "1,John Doe,29,...". Note: Monaco renders spaces as
  // non-breaking spaces, hence \s in the patterns below.)
  await runQueryAndExpect(page, "return data.length", /^15$/, 15000)

  // Access by column index
  await runQueryAndExpect(page, "return data[0][1]", /^John\sDoe$/)
  await runQueryAndExpect(page, "return data[0][5]", /^usa$/) // transformed

  // Access by proxied column name
  await runQueryAndExpect(page, 'return data[0]["Name"]', /^John\sDoe$/)
  await runQueryAndExpect(page, 'return data[0]["Country"]', /^usa$/) // transformed

  // Proxied name access across all rows
  await runQueryAndExpect(
    page,
    'return data.filter(row => row["Country"] === "usa").length',
    /^15$/,
  )

  // Mixed index and name access across all rows
  await runQueryAndExpect(
    page,
    'return data.filter(row => row[5] === "usa" && row["Name"] === "John Doe").length',
    /^1$/,
  )

  // headers argument
  await runQueryAndExpect(page, "return headers[5]", /^Country$/)
})

test(`Transformer as new column: access by shifted index and proxied name`, async ({
  page,
}) => {
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await page.getByTestId("transform-new").click()
  await page
    .getByTestId("transformCodeInput")
    .locator("textarea")
    .fill("return 'NEW ' + value")
  await page.getByTestId("btnTransformApply").click()

  // New column "Name Trans" is inserted at index 2, later columns shift by one
  await expect(page.getByTestId("valueInspector_2_Name Trans")).toBeVisible()

  // Filter USA via the shifted Country inspector (index 5 -> 6).
  // Note: queries below are order-independent because clicking the header
  // above sorted the rows.
  const countryInspector = page.getByTestId("valueInspector_6_Country")
  await countryInspector.click()
  await countryInspector.getByRole("link", { name: "USA", exact: true }).click()
  await expect(page.getByTestId("filterExplanationTrigger")).toHaveText(
    "15 filtered",
  )

  await page.getByTestId("btnFreeQueryView").click()

  await runQueryAndExpect(page, "return data.length", /^15$/, 15000)

  // Original column intact at index 1, inserted column correct at index 2
  // ("1,John Doe,29,...,USA,...")
  await runQueryAndExpect(
    page,
    "return data.find(row => row[1] === 'John Doe')[2]",
    /^NEW\sJohn\sDoe$/,
  )

  // Inserted column by proxied name (and original column by proxied name)
  await runQueryAndExpect(
    page,
    "return data.find(row => row['Name'] === 'Robert Brown')['Name Trans']",
    /^NEW\sRobert\sBrown$/,
  )

  // Proxied names still resolve correctly for columns shifted by the insert
  await runQueryAndExpect(
    page,
    "return data.find(row => row['Name'] === 'John Doe')['Age']",
    /^29$/,
  )

  // Shifted columns by index (Age 2 -> 3); one USA row has Age 27
  await runQueryAndExpect(
    page,
    "return data.filter(row => row[3] === '27').length",
    /^1$/,
  )

  // Index and name access agree for every row
  await runQueryAndExpect(
    page,
    "return data.every(row => row[2] === row['Name Trans'])",
    /^true$/,
  )

  // Shifted Country column (5 -> 6) by index across all rows
  await runQueryAndExpect(
    page,
    "return data.filter(row => row[6] === 'USA').length",
    /^15$/,
  )

  // headers argument contains the inserted column at the shifted position
  await runQueryAndExpect(page, "return headers[2]", /^Name\sTrans$/)
})
