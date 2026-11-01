import { test, expect } from "@playwright/test"
import path from "path"

// Seed the stored theme before the page loads, so the layout bootstrap script
// applies dark mode before first paint (same path a real user takes after
// having toggled dark mode once).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark")
  })
  await page.goto("http://localhost:3000/")
  await page.setViewportSize({ width: 1920, height: 2000 })
  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(import.meta.dirname, "../files", "sample.json"),
  )
})

test("Dark mode - table", async ({ page }) => {
  await expect(page.locator(".dark")).toHaveCount(1)
  await expect(page).toHaveScreenshot()
})

test("Dark mode - visual view", async ({ page }) => {
  await page.getByTestId("btnVisualView").click()
  await expect(page.locator(".dark")).toHaveCount(1)
  await expect(page).toHaveScreenshot({ fullPage: true })
})
