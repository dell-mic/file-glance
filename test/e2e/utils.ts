import { Page } from "@playwright/test"

export async function waitForClipboard(
  page: Page,
  { timeout = 2000, interval = 50 } = {},
) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const text = await page.evaluate(() => navigator.clipboard.readText())
    if (text) return text
    await page.waitForTimeout(interval)
  }
  throw new Error("Timed out waiting for clipboard to be filled")
}
