import { test, expect, type Page } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")
})

async function uploadFixture(page: Page, file: string) {
  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(path.join(import.meta.dirname, "../files", file))
}

test("parses a zipped CSV file", async ({ page }) => {
  await uploadFixture(page, "sample.csv.zip")

  await expect(page.getByTestId("DataTable")).toContainText("John Doe")
  await expect(page.getByTestId("DataTable")).toContainText(
    "johndoe@example.com",
  )
})

test("parses multiple CSV files from a ZIP archive", async ({ page }) => {
  await uploadFixture(page, "multi-file-sample.zip")

  await expect(page.getByTestId("DataTable")).toContainText("file1_row1")
  await expect(page.getByTestId("DataTable")).toContainText("file2_row2")
  await expect(page.getByTestId("DataTable")).toContainText("file3_row3")
  await expect(page.getByTestId("DataTable")).not.toContainText("__MACOSX")
})

test("parses the customers-100 ZIP archive", async ({ page }) => {
  await uploadFixture(page, "customers-100.zip")

  await expect(page.getByTestId("DataTable")).toBeVisible()
  await expect(page.getByTestId("DataTable")).toContainText("1Ef7b82A4CAAD10")
})
