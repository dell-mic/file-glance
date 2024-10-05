import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(path.join(__dirname, "../files", "sample.csv"))
})

test(`Sorting via header click`, async ({ page }) => {
  await page.getByTestId("header_2_Age").click()
  await expect(page).toHaveScreenshot()
})
