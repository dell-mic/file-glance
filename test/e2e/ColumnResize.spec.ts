import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(import.meta.dirname, "../files", "sample.csv"),
  )
})

test(`Column resize via drag and reset via double-click`, async ({ page }) => {
  const header = page.getByTestId("header_2_Age")
  const resizeHandle = page.getByTestId("headerResize_2_Age")

  const initialWidth = (await header.boundingBox())!.width
  const handleBox = (await resizeHandle.boundingBox())!
  const handleCenterY = handleBox.y + handleBox.height / 2

  // Drag the resize handle 100px to the right
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleCenterY)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + 100, handleCenterY, { steps: 5 })
  await page.mouse.up()

  const resizedWidth = (await header.boundingBox())!.width
  expect(resizedWidth).toBeGreaterThan(initialWidth + 95)
  expect(resizedWidth).toBeLessThan(initialWidth + 105)

  // Double-click the handle to reset back to automatic width
  await resizeHandle.dispatchEvent("dblclick")

  const resetWidth = (await header.boundingBox())!.width
  expect(Math.abs(resetWidth - initialWidth)).toBeLessThan(1)
})

test(`Column resize is clamped to a minimum width`, async ({ page }) => {
  const header = page.getByTestId("header_2_Age")
  const resizeHandle = page.getByTestId("headerResize_2_Age")

  const handleBox = (await resizeHandle.boundingBox())!
  const handleCenterY = handleBox.y + handleBox.height / 2

  // Drag the resize handle far to the left
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleCenterY)
  await page.mouse.down()
  await page.mouse.move(handleBox.x - 500, handleCenterY, { steps: 5 })
  await page.mouse.up()

  const resizedWidth = (await header.boundingBox())!.width
  expect(resizedWidth).toBe(40)
})
