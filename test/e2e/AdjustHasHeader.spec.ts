import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")
})

test(`Adjust hasHeader manually`, async ({ page }) => {
  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(__dirname, "../files", "similarHeader.csv"),
  ) // Expected to be parsed "without header" by heuristic

  await expect(page.getByTestId("switch-hasHeader").isEnabled()).toBeTruthy()
  await page.getByTestId("switch-hasHeader").click()

  await expect(page).toHaveScreenshot()
})
