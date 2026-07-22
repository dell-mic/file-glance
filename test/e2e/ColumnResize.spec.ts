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

test(`Double-click fits column to content, second double-click resets`, async ({
  page,
}) => {
  const header = page.getByTestId("header_2_Age")
  const resizeHandle = page.getByTestId("headerResize_2_Age")

  const initialWidth = (await header.boundingBox())!.width

  // Double-click on the default width fits the column to its (short) contents
  await resizeHandle.dispatchEvent("dblclick")

  const fittedWidth = (await header.boundingBox())!.width
  expect(fittedWidth).toBeLessThan(initialWidth)
  expect(fittedWidth).toBeGreaterThanOrEqual(40)

  // Double-click again resets back to automatic width
  await resizeHandle.dispatchEvent("dblclick")

  const resetWidth = (await header.boundingBox())!.width
  expect(Math.abs(resetWidth - initialWidth)).toBeLessThan(1)
})

test(`Column fit to content is clamped to the maximum width`, async ({
  page,
}) => {
  const longValue = "x".repeat(300)
  await page.goto("about:blank")
  await page.goto(
    "http://localhost:3000/#d=" + encodeURI(`col1,col2\n${longValue},y`),
  )
  await page.waitForSelector('[data-testid="DataTable"]', { state: "visible" })

  // Note: hasHeader detection treats the first row as data here, so the
  // columns get auto-generated names
  const header = page.getByTestId("header_0_col_01")
  const resizeHandle = page.getByTestId("headerResize_0_col_01")

  const initialWidth = (await header.boundingBox())!.width

  await resizeHandle.dispatchEvent("dblclick")

  const fittedWidth = (await header.boundingBox())!.width
  expect(fittedWidth).toBe(800)
  expect(fittedWidth).toBeGreaterThan(initialWidth)
})
