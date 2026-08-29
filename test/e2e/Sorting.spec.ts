import { test, expect } from "@playwright/test"
import path from "path"
import { fillCodeEditor } from "./utils"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(import.meta.dirname, "../files", "sample.csv"),
  )
})

test(`Sorting via header click`, async ({ page }) => {
  await page.getByTestId("header_2_Age").click()
  await expect(page).toHaveScreenshot()
})

test(`Sorting follows its column after transform-as-new-column`, async ({
  page,
}) => {
  // Sort Age (displayed index 2) ascending. The header click both renders and
  // applies the sort synchronously (no transformers yet => main-thread path).
  const ageCell = page.locator('[data-column="Age"]').first()
  const preSortFirstAge = (await ageCell.textContent()) ?? ""
  await page.getByTestId("header_2_Age").click()
  // Wait for the ascending sort to land, so the captured "before" value is the
  // sorted one (guard against a stale pre-sort first cell).
  await expect(ageCell).not.toHaveText(preSortFirstAge)
  const ageBefore = ((await ageCell.textContent()) ?? "").trim()

  // Open the menu on Name (index 1) WITHOUT clicking the header itself: a
  // header click would replace the Age sort. Hovering reveals the menu button
  // (group-hover CSS), and the button stops propagation so the sort is
  // untouched. Then insert a new column after Name, shifting Age 2 -> 3.
  await page.getByTestId("header_1_Name").hover()
  await page.getByTestId("headerBtn_1_Name").click()
  await page.getByTestId("menuEntry-Transform").click()
  await page.getByTestId("transform-new").click()
  await fillCodeEditor(page, "transformCodeInput", "return 'NEW ' + value")
  await page.getByTestId("btnTransformApply").click()

  // Sync: the new column header only appears after the worker recomputes, so
  // waiting on it also waits for the re-sort. Without this, sort/arrow
  // assertions could pass against stale (pre-recalc) DOM.
  await expect(page.getByTestId("header_2_Name Trans")).toBeVisible()

  // The sort must still target Age (now at displayed index 3). Without the
  // sortSetting shift, orderBy would sort by the new column instead, so the
  // first Age cell would no longer be the ascending-age minimum.
  await expect(ageCell).toHaveText(ageBefore)

  // Sort indicator moved along to the shifted Age header...
  await expect(
    page.getByTestId("header_3_Age").locator("span svg"),
  ).toBeVisible()
  // ...and is NOT on the newly inserted column (it would be there without the
  // shift, since sortSetting.columnIndex would still be 2).
  await expect(
    page.getByTestId("header_2_Name Trans").locator("span svg"),
  ).toHaveCount(0)
})
