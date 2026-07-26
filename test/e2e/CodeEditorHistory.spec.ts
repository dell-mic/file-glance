import { test, expect } from "@playwright/test"
import path from "path"
import { fillCodeEditor } from "./utils"

// The transformer/filter code inputs keep a localStorage-backed history that
// is browsed with ArrowUp/ArrowDown — devtools-console style: only from the
// first/last line and while no autocomplete widget is open, so the arrows
// still move the cursor and the widget selection. These tests pin that
// behavior.

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(import.meta.dirname, "../files", "sample.csv"),
  )
})

test(`Transform dialog: arrow keys browse input history`, async ({ page }) => {
  const openDialog = async () => {
    await page.getByTestId("header_1_Name").click()
    await page.getByTestId("headerBtn_1_Name").click()
    await page.getByTestId("menuEntry-Transform").click()
  }

  // Apply a transformation; applying stores the code in the history
  await openDialog()
  await fillCodeEditor(page, "transformCodeInput", "return value.toUpperCase()")
  await page.getByTestId("btnTransformApply").click()

  // Reopen, type a draft, then browse the history away from it and back
  await openDialog()
  const viewLines = page
    .getByTestId("transformCodeInput")
    .locator(".view-lines")
  await fillCodeEditor(page, "transformCodeInput", "return 'draft'")
  await page.keyboard.press("ArrowUp")
  await expect(viewLines).toContainText("return value.toUpperCase()")
  await page.keyboard.press("ArrowDown")
  await expect(viewLines).toContainText("return 'draft'")
})

test(`Filter dialog: arrow keys browse input history`, async ({ page }) => {
  // Apply a filter; closing the dialog stores the code in the history
  await page.getByTestId("btnFilter").click()
  await fillCodeEditor(
    page,
    "filterCodeInput",
    "return parseInt(row['ID']) === 1",
  )
  await page.waitForTimeout(600)
  await expect(page.getByTestId("btnFilterApply")).toBeEnabled()
  await page.getByTestId("btnFilterApply").click()

  // Reopen (draft is restored to the applied code), replace it, then browse
  // the history away from it and back
  await page.getByTestId("btnFilter").click()
  const viewLines = page.getByTestId("filterCodeInput").locator(".view-lines")
  await fillCodeEditor(page, "filterCodeInput", "return true")
  await page.keyboard.press("ArrowUp")
  await expect(viewLines).toContainText("return parseInt(row['ID']) === 1")
  await page.keyboard.press("ArrowDown")
  await expect(viewLines).toContainText("return true")
})

test(`Filter dialog: arrow keys control the autocomplete widget, not history`, async ({
  page,
}) => {
  // Apply a filter; this stores the code in the history
  await page.getByTestId("btnFilter").click()
  await fillCodeEditor(page, "filterCodeInput", "return true")
  await page.waitForTimeout(600)
  await expect(page.getByTestId("btnFilterApply")).toBeEnabled()
  await page.getByTestId("btnFilterApply").click()

  // Reopen, clear the draft and type `row.` to open the member completions
  await page.getByTestId("btnFilter").click()
  await fillCodeEditor(page, "filterCodeInput", "")
  await page.keyboard.type("return row.")

  const viewLines = page.getByTestId("filterCodeInput").locator(".view-lines")
  const suggestWidget = page.locator(".suggest-widget.visible")
  await expect(suggestWidget).toBeVisible()

  // With the widget open, the arrows move the widget selection and must not
  // swap in history entries
  const focusedRow = suggestWidget.locator(".monaco-list-row.focused")
  await expect(focusedRow).toHaveCount(1)
  const initiallyFocused = await focusedRow.textContent()
  await page.keyboard.press("ArrowDown")
  await expect(focusedRow).not.toHaveText(initiallyFocused ?? "")
  await page.keyboard.press("ArrowUp")
  await expect(viewLines).toContainText("return row.")
  await expect(viewLines).not.toContainText("return true")

  // Enter accepts the focused suggestion (acceptSuggestionOnEnter: "smart")
  // instead of inserting a newline or browsing the history
  await page.keyboard.press("Enter")
  await expect(suggestWidget).toHaveCount(0)
  await expect(viewLines).not.toHaveText("return row.")

  // With the widget closed again, ArrowUp browses the history (the cursor is
  // on the first/only line)
  await page.keyboard.press("ArrowUp")
  await expect(viewLines).toContainText("return true")
})
