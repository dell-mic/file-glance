import { test, expect } from "@playwright/test"
import path from "path"

// Upload a sample file before each test

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(path.join(__dirname, "../files", "sample.csv"))
})

test(`Filter dialog filters rows`, async ({ page }) => {
  await page.getByTestId("btnFilter").click()
  await page
    .getByTestId("filterCodeInput")
    .locator("textarea")
    .fill("return parseInt(row['ID']) === 1")
  // Wait for debounce and for matching rows count to update
  await page.waitForTimeout(600)
  await expect(page.getByTestId("btnFilterApply")).toBeEnabled()
  await page.getByTestId("btnFilterApply").click()
  await expect(page).toHaveScreenshot()
})

test(`Filter dialog disables Apply for no matches`, async ({ page }) => {
  await page.getByTestId("btnFilter").click()
  // Fill in a filter function that matches nothing
  await page
    .getByTestId("filterCodeInput")
    .locator("textarea")
    .fill("return false")
  await page.waitForTimeout(600)
  await expect(page.getByTestId("btnFilterApply")).toBeDisabled()
})
