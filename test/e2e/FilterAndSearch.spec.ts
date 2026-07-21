import { test, expect } from "@playwright/test"
import path from "path"

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
  await page
    .getByTestId("filterCodeInput")
    .locator("textarea")
    .fill("return parseInt(row['Salary']) > 100000")
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
