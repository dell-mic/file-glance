import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")
  await page.setViewportSize({ width: 1920, height: 2000 })
  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(import.meta.dirname, "../files", "sample.json"),
  )
  await page.getByTestId("btnVisualView").click()
})

test(`Visual View`, async ({ page }) => {
  await expect(page).toHaveScreenshot({ fullPage: true })
})

test(`Visual View - filtered`, async ({ page }) => {
  await page.getByTestId("valueInspector_0_city").click()
  const cityValue = page
    .getByTestId("valueInspector_0_city")
    .locator("a")
    .first()
  await cityValue.click()
  // The baseline screenshot includes the value tooltip; keep hovering the
  // value and wait for the tooltip so its appearance is deterministic.
  await cityValue.hover()
  await expect(
    page.locator("[data-radix-popper-content-wrapper]"),
  ).toBeVisible()
  await expect(page).toHaveScreenshot({ fullPage: true })
})
