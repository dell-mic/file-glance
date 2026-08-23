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

test(`Searching global`, async ({ page }) => {
  await page.getByTestId("searchInput").fill("27")
  await expect(page).toHaveScreenshot()
})

test(`Searching in column`, async ({ page }) => {
  await page.getByTestId("searchInput").fill("ID:27")
  await expect(page).toHaveScreenshot()
})

test(`Search is case-insensitive by default`, async ({ page }) => {
  // "canada" (lowercase) matches the 13 "Canada" rows by default
  await page.getByTestId("searchInput").fill("canada")
  await expect(page.getByTestId("filterExplanationTrigger")).toHaveText(
    "13 filtered",
  )
})

test(`Match Case toggle makes search case-sensitive`, async ({ page }) => {
  const input = page.getByTestId("searchInput")
  await input.fill("canada")
  await expect(page.getByTestId("filterExplanationTrigger")).toHaveText(
    "13 filtered",
  )

  await page.getByTestId("searchOptCase").click()
  await expect(page.getByTestId("filterExplanationTrigger")).toHaveText(
    "0 filtered",
  )
})

test(`Regex search mode`, async ({ page }) => {
  await page.getByTestId("searchOptRegex").click()
  await page.getByTestId("searchInput").fill(`ID:^10$`)
  await expect(page.getByTestId("filterExplanationTrigger")).toHaveText(
    "1 filtered",
  )
})

test(`Invalid regex shows error and ignores the search`, async ({ page }) => {
  const input = page.getByTestId("searchInput")
  await page.getByTestId("searchOptRegex").click()
  await input.fill("[unclosed")

  await expect(input).toHaveClass(/border-red-500/)
  // Search is ignored -> all rows remain visible
  await expect(page.getByTestId("filterExplanationTrigger")).toHaveText(
    "50 filtered",
  )
})

test(`Filter on value`, async ({ page }) => {
  // Includes filter variant
  await page.getByTestId("valueInspector_2_Age").click()
  await page.getByTestId("valueInspector_2_Age").locator("a").first().click()
  await page
    .getByTestId("valueInspector_2_Age")
    .locator("a")
    .nth(1)
    .click({ modifiers: ["Meta"] })

  // Excludes
  await page.getByTestId("valueInspector_5_Country").click()
  await page
    .getByTestId("valueInspector_5_Country")
    .locator("a")
    .first()
    .click({ modifiers: ["Alt"] })

  // Park the mouse so no value-hover tooltip leaks into the snapshot
  await page.mouse.move(660, 500)

  await expect(page).toHaveScreenshot()
})

test(`Filter explanation on hover`, async ({ page }) => {
  await page.getByTestId("valueInspector_2_Age").click()
  await page.getByTestId("valueInspector_2_Age").locator("a").first().click()

  const trigger = page.getByTestId("filterExplanationTrigger")
  await expect(trigger).toBeVisible()
  await trigger.hover()

  const card = page.locator("[data-radix-popper-content-wrapper]")
  await expect(card.getByText("rows match")).toBeVisible()
  await expect(card.getByText(/^Age = '.+'$/)).toBeVisible()
})

test(`Filter explanation popover snapshot`, async ({ page }) => {
  // Custom filter function (applied first so dialog validation has matches)
  await page.getByTestId("btnFilter").click()
  await fillCodeEditor(
    page,
    "filterCodeInput",
    "return parseInt(row['Salary']) > 100000",
  )
  // Wait for debounce and for matching rows count to update
  await page.waitForTimeout(600)
  await expect(page.getByTestId("btnFilterApply")).toBeEnabled()
  await page.getByTestId("btnFilterApply").click()

  // Include two Age values (OR-ed)
  await page.getByTestId("valueInspector_2_Age").click()
  await page.getByTestId("valueInspector_2_Age").locator("a").first().click()
  await page
    .getByTestId("valueInspector_2_Age")
    .locator("a")
    .nth(1)
    .click({ modifiers: ["Meta"] })

  // Exclude one Country value
  await page.getByTestId("valueInspector_5_Country").click()
  await page
    .getByTestId("valueInspector_5_Country")
    .locator("a")
    .first()
    .click({ modifiers: ["Alt"] })

  // Column-scoped search
  await page.getByTestId("searchInput").fill("Country:Canada")

  const trigger = page.getByTestId("filterExplanationTrigger")
  await expect(trigger).toBeVisible()
  await trigger.hover()

  const card = page.getByTestId("filterExplanationCard")
  await expect(card).toBeVisible()
  await expect(card).toHaveScreenshot({ animations: "disabled" })
})
