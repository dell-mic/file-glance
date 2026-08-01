import { test, expect } from "@playwright/test"
import path from "path"
import { fillCodeEditor } from "./utils"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(import.meta.dirname, "../files", "sample.csv"),
  )
})

test(`Transform column`, async ({ page }) => {
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await fillCodeEditor(
    page,
    "transformCodeInput",
    "return 'NEW ' + value + ' xxx'",
  )
  await page.getByTestId("btnTransformApply").click()
  await expect(page).toHaveScreenshot()
})

test(`Transform column as new column`, async ({ page }) => {
  // Hide & expand column after new ones to to verify column index adjustments
  await page.getByTestId("btn-hide-valueInspector_2_Age").click()
  await page.getByTestId("valueInspector_5_Country").click()

  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await page.getByTestId("transform-new").click()
  await fillCodeEditor(
    page,
    "transformCodeInput",
    "return 'NEW ' + value + ' xxx'",
  )
  await page.getByTestId("btnTransformApply").click()
  await expect(page).toHaveScreenshot()
})

test(`originalValue refers to pre-transform cell, not mutated value`, async ({
  page,
}) => {
  // Transformer 1: wrap the Name cell with $$ sentinels
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await fillCodeEditor(page, "transformCodeInput", 'return "$$" + value + "$$"')
  await page.getByTestId("btnTransformApply").click()

  // Transformer 2 (same column): reset to originalValue
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await fillCodeEditor(page, "transformCodeInput", "return originalValue")
  await page.getByTestId("btnTransformApply").click()

  // With the fix: the cell reverts to "John Doe".
  // Without the fix (originalValue === value): the cell stays "$$John Doe$$".
  await expect(page.getByTestId("DataTable")).not.toContainText("$$John Doe$$")
  await expect(page.getByTestId("DataTable")).toContainText("John Doe")
})

test(`Preview uses originalValue from pre-transform cell`, async ({ page }) => {
  // Upstream transformer: uppercase the Name column.
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await fillCodeEditor(page, "transformCodeInput", "return value.toUpperCase()")
  await page.getByTestId("btnTransformApply").click()

  // Open transform dialog on the same column; the preview should distinguish
  // originalValue (pre-transform, e.g. "John Doe") from value (post-transform,
  // "JOHN DOE"). Without the fix originalValue === value, so the result would
  // be "JOHN DOE / JOHN DOE".
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await fillCodeEditor(
    page,
    "transformCodeInput",
    "return originalValue + ' / ' + value",
  )

  const dialog = page.locator("#columnTransformDialog")
  await expect(dialog).toContainText("John Doe / JOHN DOE")
  await expect(dialog).not.toContainText("JOHN DOE / JOHN DOE")
})

test(`originalValue stays aligned after transform-as-new-column shifts columns`, async ({
  page,
}) => {
  // Transformer 1: duplicate Name as new column, shifting Age from
  // displayed index 2 to 3 (Email from 3 to 4, ...)
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await page.getByTestId("transform-new").click()
  await fillCodeEditor(page, "transformCodeInput", "return 'NEW ' + value")
  await page.getByTestId("btnTransformApply").click()

  // Transformer 2 on Age (now displayed at index 3): expose originalValue.
  // Correct alignment: Age shows "29_orig" for John Doe's row. Off-by-one
  // (looking up pristine index 3 = Email): "johndoe@example.com_orig".
  await page.getByTestId("header_3_Age").click()
  await page.getByTestId("headerBtn_3_Age").click()
  await page.getByTestId("menuEntry-Transform").click()
  await fillCodeEditor(
    page,
    "transformCodeInput",
    "return originalValue + '_orig'",
  )
  await page.getByTestId("btnTransformApply").click()

  await expect(page.getByTestId("DataTable")).toContainText("29_orig")
  await expect(page.getByTestId("DataTable")).not.toContainText(
    "johndoe@example.com_orig",
  )
})

test(`in-place transform keeps targeting its column when a later as-new-column shifts it`, async ({
  page,
}) => {
  // Transformer 1: transform Age (displayed index 2) in place
  await page.getByTestId("header_2_Age").click()
  await page.getByTestId("headerBtn_2_Age").click()
  await page.getByTestId("menuEntry-Transform").click()
  await fillCodeEditor(page, "transformCodeInput", "return value + '_age'")
  await page.getByTestId("btnTransformApply").click()

  // Transformer 2: transform Name (index 1) as new column. The new column is
  // inserted at index 2 - exactly the index transformer 1 targets.
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await page.getByTestId("transform-new").click()
  await fillCodeEditor(page, "transformCodeInput", "return 'NEW ' + value")
  await page.getByTestId("btnTransformApply").click()

  // Expected: Age (now at displayed index 3) still gets transformed, and the
  // new column shows "NEW John Doe". Buggy (stale index 2): the new column
  // shows "NEW John Doe_age" and Age stays untransformed.
  await expect(page.getByTestId("DataTable")).toContainText("29_age")
  await expect(page.getByTestId("DataTable")).toContainText("NEW John Doe")
  await expect(page.getByTestId("DataTable")).not.toContainText(
    "NEW John Doe_age",
  )
})

test(`Filters follow their columns after transform-as-new-column`, async ({
  page,
}) => {
  // Include-filter the most common Age value (column 2, shifts to 3 once a new
  // column is inserted before it).
  await page.getByTestId("valueInspector_2_Age").click()
  await page.getByTestId("valueInspector_2_Age").locator("a").first().click()

  const trigger = page.getByTestId("filterExplanationTrigger")
  const filteredText = ((await trigger.textContent()) ?? "").trim()
  expect(filteredText.length).toBeGreaterThan(0)

  // Insert a new column after Name (index 1), shifting Age 2 -> 3.
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await page.getByTestId("transform-new").click()
  await fillCodeEditor(page, "transformCodeInput", "return 'NEW ' + value")
  await page.getByTestId("btnTransformApply").click()

  // Sync on the new column header appearing (worker recalc done), so the
  // assertion below compares against updated state, not stale DOM.
  await expect(page.getByTestId("header_2_Name Trans")).toBeVisible()
  await expect(page.getByTestId("DataTable")).toContainText("NEW ")

  // Same rows still match: the Age filter shifted along with its column.
  // Without the shift, the filter would target the new column ("Name Trans")
  // and the match count would drop to zero.
  await expect(trigger).toHaveText(filteredText)

  // The filter highlight moved to the shifted Age accordion: openAccordions
  // shifted 2 -> 3, so valueInspector_3_Age is already open and the previously
  // clicked value is still marked as an active include filter.
  await expect(
    page.getByTestId("valueInspector_3_Age").locator("a.font-medium").first(),
  ).toBeVisible()

  // The filter description still resolves to the correct (shifted) column.
  await trigger.hover()
  const card = page.getByTestId("filterExplanationCard")
  await expect(card).toBeVisible()
  await expect(card.getByText(/^Age = '.+'$/)).toBeVisible()
})

test(`Filter on the transformed column itself survives unshifted`, async ({
  page,
}) => {
  // Include-filter a Name value (column 1 == the transform target column,
  // which intentionally does NOT shift - as-new-column leaves it in place).
  await page.getByTestId("valueInspector_1_Name").click()
  await page.getByTestId("valueInspector_1_Name").locator("a").first().click()

  const trigger = page.getByTestId("filterExplanationTrigger")
  const filteredText = ((await trigger.textContent()) ?? "").trim()
  expect(filteredText.length).toBeGreaterThan(0)

  // Insert a new column after Name (index 1).
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await page.getByTestId("transform-new").click()
  await fillCodeEditor(page, "transformCodeInput", "return 'NEW ' + value")
  await page.getByTestId("btnTransformApply").click()

  // Sync on the new column header appearing (worker recalc done).
  await expect(page.getByTestId("header_2_Name Trans")).toBeVisible()

  // The Name filter stays on column 1 (shift rule is strictly `>`), so the
  // match count is unchanged. An over-eager shift (shifting `>=` too) would
  // land the filter on the new column and drop the count to zero.
  await expect(trigger).toHaveText(filteredText)

  // The Name accordion is still the one carrying the active filter highlight.
  await expect(
    page.getByTestId("valueInspector_1_Name").locator("a.font-medium").first(),
  ).toBeVisible()
})
