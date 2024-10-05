import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(path.join(__dirname, "../files", "sample.csv"))
})

test(`Transform column`, async ({ page }) => {
  await page.getByTestId("header_1_Name").click()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.locator('button:text("Transform")').click()
  await page
    .getByTestId("transformCodeInput")
    .locator("textarea")
    .fill("return 'NEW ' + value + ' xxx'")
  await page.getByTestId("btnTransfomApply").click()
  await expect(page).toHaveScreenshot()
})
