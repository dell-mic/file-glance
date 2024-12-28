import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")
})

const files = [
  "WithHeaderAndTabs.xlsx",
  "missing_header.tsv",
  "sample.csv",
  "small_sample.tsv",
  "noHeader_sample.csv",
  "sample.json",
  "long_values.csv",
]

files.forEach((file) => {
  test(`${file}`, async ({ page }) => {
    const fileChooserPromise = page.waitForEvent("filechooser")
    await page.getByTestId("fileInput").click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(path.join(__dirname, "../files", file))

    await expect(page).toHaveScreenshot()
  })
})
