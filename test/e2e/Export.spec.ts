import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(__dirname, "../files", "small_sample.tsv"),
  )
})

test(`Share Link`, async ({ page, context, browserName }) => {
  test.skip(
    browserName === "webkit",
    "Webkit seems not to implement clipboard read and fails with: Error: page.evaluate: NotAllowedError: The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.",
  )

  // Adjust hidden columns
  await page.getByTestId("btn-hide-valueInspector_2_Other parameter").click()

  // Adjust transformer
  // TODO: Duplicate code from Transformer test
  await page.getByTestId("header_0_Some parameter").click()
  await page.getByTestId("headerBtn_0_Some parameter").click()
  await page.locator('button:text("Transform")').click()
  await page
    .getByTestId("transformCodeInput")
    .locator("textarea")
    .fill("return 'NEW ' + value + ' xxx'")
  await page.getByTestId("btnTransformApply").click()

  // Actual export via link
  await page.getByTestId("btnExport").click()
  await page.locator('button:text("Share Link")').click()

  // Get clipboard text from the page context
  const clipboardText = await page.evaluate(() =>
    navigator.clipboard.readText(),
  )
  // console.log("Clipboard text:", clipboardText)

  const page2 = await context.newPage()
  await page2.goto(clipboardText)

  await expect(page2).toHaveScreenshot()
})
