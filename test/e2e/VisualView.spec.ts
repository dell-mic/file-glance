import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")
  await page.setViewportSize({ width: 1920, height: 1400 })
  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(path.join(__dirname, "../files", "sample.json"))
  await page.getByTestId("btnVisualView").click()
})

test(`Visual View`, async ({ page }) => {
  await expect(page).toHaveScreenshot()
})

test(`Visual View - filtered`, async ({ page }) => {
  await page.getByTestId("valueInspector_0_city").click()
  await page.getByTestId("valueInspector_0_city").locator("a").first().click()
  await expect(page).toHaveScreenshot()
})
