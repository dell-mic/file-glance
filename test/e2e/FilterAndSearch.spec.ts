import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(path.join(__dirname, "../files", "sample.csv"))
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
  await page.getByTestId("valueInspector_2_Age").click()
  await page.getByTestId("valueInspector_2_Age").locator("a").first().click()
  await expect(page).toHaveScreenshot()
})
