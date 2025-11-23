import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")
})

test(`Multiple files with headers`, async ({ page }) => {
  const files = [
    "multi-file-w-header-sample_1.csv",
    "multi-file-w-header-sample_2.csv",
    "multi-file-w-header-sample_3.csv",
  ]

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    files.map((file) => path.join(import.meta.dirname, "../files", file)),
  )

  await expect(page).toHaveScreenshot()
})

test(`Multiple files without headers`, async ({ page }) => {
  const files = [
    "multi-file-wo-header-sample_1.csv",
    "multi-file-wo-header-sample_2.csv",
    "multi-file-wo-header-sample_3.csv",
  ]

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    files.map((file) => path.join(import.meta.dirname, "../files", file)),
  )

  await expect(page).toHaveScreenshot()
})
