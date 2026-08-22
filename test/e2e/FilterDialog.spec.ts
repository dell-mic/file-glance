import { test, expect } from "@playwright/test"
import path from "path"
import { fillCodeEditor } from "./utils"

// Upload a sample file before each test

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(import.meta.dirname, "../files", "sample.csv"),
  )
})

test(`Filter dialog filters rows`, async ({ page }) => {
  await page.getByTestId("btnFilter").click()
  await fillCodeEditor(
    page,
    "filterCodeInput",
    "return parseInt(row['ID']) === 1",
  )
  // Wait for debounce and for matching rows count to update
  await page.waitForTimeout(600)
  await expect(page.getByTestId("btnFilterApply")).toBeEnabled()
  await page.getByTestId("btnFilterApply").click()
  await expect(page).toHaveScreenshot()
})

test(`Filter dialog autocompletes column names`, async ({ page }) => {
  await page.getByTestId("btnFilter").click()
  const editor = page.getByTestId("filterCodeInput").locator(".monaco-editor")
  await editor.waitFor()
  await editor.click()
  const suggestWidget = page.locator(".suggest-widget")
  const viewLines = page.getByTestId("filterCodeInput").locator(".view-lines")

  // Dot access: row.<name> suggests column names (via the typed extraLib).
  // Identifiers are inserted as plain properties (accept with Tab — Enter
  // is disabled by design)
  await page.keyboard.type("return row.Ag", { delay: 50 })
  await expect(suggestWidget).toBeVisible()
  await expect(suggestWidget).toContainText("Age")
  await page.keyboard.press("Tab")
  await expect(viewLines).toHaveText(/return\srow\.Age/)

  // A column that is not a valid identifier cannot follow a dot; inside
  // brackets it is suggested as a string literal. Accepting inserts only
  // the bare member name (monaco's ts worker adds no closing quote).
  await fillCodeEditor(page, "filterCodeInput", "")
  await page.keyboard.type('return row["Ph', { delay: 50 })
  await expect(suggestWidget).toContainText("Phone Number")
  await page.keyboard.press("Tab")
  await expect(viewLines).toHaveText('return row["Phone Number')

  // Dot access also works at runtime (row proxy maps names to indices)
  await fillCodeEditor(page, "filterCodeInput", 'return row.ID === "1"')
  await page.waitForTimeout(600)
  await expect(page.locator("#filterDialog")).toContainText("Matching rows: 1")
  await expect(page.getByTestId("btnFilterApply")).toBeEnabled()
})

test(`Filter dialog suggests string methods on string columns`, async ({
  page,
}) => {
  await page.getByTestId("btnFilter").click()
  const editor = page.getByTestId("filterCodeInput").locator(".monaco-editor")
  await editor.waitFor()
  await editor.click()
  const suggestWidget = page.locator(".suggest-widget")

  // All values of "Name" are strings -> string method completions are
  // offered after row.Name. (filter so "trim" is in the visible list)
  await page.keyboard.type("return row.Name.tr", { delay: 50 })
  await expect(suggestWidget).toBeVisible()
  await expect(suggestWidget).toContainText("trim")
})

test(`Filter dialog disables Apply for no matches`, async ({ page }) => {
  await page.getByTestId("btnFilter").click()
  // Fill in a filter function that matches nothing
  await fillCodeEditor(page, "filterCodeInput", "return false")
  await page.waitForTimeout(600)
  await expect(page.getByTestId("btnFilterApply")).toBeDisabled()
})

test(`Filter dialog shows syntax errors`, async ({ page }) => {
  await page.getByTestId("btnFilter").click()
  await fillCodeEditor(page, "filterCodeInput", "return row[")
  await page.waitForTimeout(600)
  await expect(page.locator("#filterDialog")).toContainText(/SyntaxError/)
  await expect(page.getByTestId("btnFilterApply")).toBeDisabled()
})

test(`Filter dialog shows runtime errors from applying the filter`, async ({
  page,
}) => {
  await page.getByTestId("btnFilter").click()
  // ReferenceError on every row: error is displayed (not only logged to the
  // console), and Apply stays disabled. (Message text is engine-specific, so
  // match the error name only.)
  await fillCodeEditor(page, "filterCodeInput", "return asdf")
  await page.waitForTimeout(600)
  await expect(page.locator("#filterDialog")).toContainText(/ReferenceError/)
  await expect(page.locator("#filterDialog")).toContainText("Matching rows: 0")
  await expect(page.getByTestId("btnFilterApply")).toBeDisabled()

  // ReferenceError only on some rows: error is displayed, but Apply stays
  // enabled for the matching rows (erroring rows count as non-matching)
  await fillCodeEditor(
    page,
    "filterCodeInput",
    'return rowIndex < 25 ? row["Name"].includes("John") : asdf',
  )
  await page.waitForTimeout(600)
  await expect(page.locator("#filterDialog")).toContainText(/ReferenceError/)
  await expect(page.locator("#filterDialog")).toContainText("Matching rows: 2")
  await expect(page.getByTestId("btnFilterApply")).toBeEnabled()
})

test(`Filter dialog Apply button does nothing when disabled`, async ({
  page,
}) => {
  await page.getByTestId("btnFilter").click()
  await page.getByTestId("filterCodeInput").locator(".monaco-editor").waitFor()
  await page.waitForTimeout(600)

  // Empty code -> Apply is disabled. A real mouse click (pointerdown) on the
  // disabled button must neither apply nor close the dialog. Browsers still
  // dispatch pointer events on disabled buttons (unlike click events).
  const apply = page.getByTestId("btnFilterApply")
  await expect(apply).toBeDisabled()
  const box = await apply.boundingBox()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.waitForTimeout(200)
  await expect(page.locator("#filterDialog")).toBeVisible()
  await expect(page.getByTestId("filterExplanationTrigger")).not.toBeVisible()
})

test(`Filter dialog disables Apply while validation is pending`, async ({
  page,
}) => {
  await page.getByTestId("btnFilter").click()
  // Valid filter -> Apply becomes enabled after the debounced validation
  await fillCodeEditor(
    page,
    "filterCodeInput",
    "return parseInt(row['ID']) === 1",
  )
  await page.waitForTimeout(600)
  await expect(page.getByTestId("btnFilterApply")).toBeEnabled()

  // After making the code invalid, Apply must be disabled again immediately
  // (well within the 500ms validation debounce) — otherwise it could apply
  // stale code and close the dialog. Poll with a short timeout because
  // toBeDisabled would happily wait out the debounce window.
  await fillCodeEditor(page, "filterCodeInput", "return false")
  await expect
    .poll(async () => page.getByTestId("btnFilterApply").isDisabled(), {
      timeout: 200,
    })
    .toBe(true)

  // Same when clearing the code (e.g. via ArrowDown to an empty history draft)
  await fillCodeEditor(
    page,
    "filterCodeInput",
    "return parseInt(row['ID']) === 1",
  )
  await page.waitForTimeout(600)
  await expect(page.getByTestId("btnFilterApply")).toBeEnabled()
  await fillCodeEditor(page, "filterCodeInput", "")
  await expect
    .poll(async () => page.getByTestId("btnFilterApply").isDisabled(), {
      timeout: 200,
    })
    .toBe(true)
})
