import { test, expect } from "@playwright/test"
import path from "path"
import { waitForClipboard } from "./utils"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(import.meta.dirname, "../files", "sample.csv"),
  )
})

test(`Double-click opens row detail dialog`, async ({ page }) => {
  await page.locator('[data-column="Name"]').first().dblclick()

  const dialog = page.getByTestId("rowDetailDialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("heading")).toHaveText("Row 1 of 50")
  // Label + value displayed (all-in-one assertion of the field layout)
  await expect(
    page.getByTestId("rowDetailField_1_Name").locator("div").last(),
  ).toHaveText("John Doe")

  // Screenshot only the dialog: a full-page shot would churn on unrelated UI changes
  await expect(dialog).toHaveScreenshot()

  await page.keyboard.press("Escape")
  await expect(dialog).not.toBeVisible()
})

test(`Enter opens dialog, Escape closes`, async ({ page }) => {
  await page.locator('[data-column="Name"]').first().click()
  await page.keyboard.press("Enter")

  const dialog = page.getByTestId("rowDetailDialog")
  await expect(dialog).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(dialog).not.toBeVisible()
})

test(`Navigate rows with buttons and ArrowUp/Down`, async ({ page }) => {
  await page.locator('[data-column="Name"]').first().dblclick()

  const prevButton = page.getByTestId("btnRowDetailPrev")
  const nextButton = page.getByTestId("btnRowDetailNext")
  const heading = page.getByTestId("rowDetailDialog").getByRole("heading")

  // Prev disabled on first row
  await expect(heading).toHaveText("Row 1 of 50")
  await expect(prevButton).toBeDisabled()

  // Next via button
  await nextButton.click()
  await expect(heading).toHaveText("Row 2 of 50")

  // Back via ArrowUp
  await page.keyboard.press("ArrowUp")
  await expect(heading).toHaveText("Row 1 of 50")

  // Forward via ArrowDown
  await page.keyboard.press("ArrowDown")
  await expect(heading).toHaveText("Row 2 of 50")
  await expect(
    page.getByTestId("rowDetailField_1_Name").locator("div").last(),
  ).toHaveText("Jane Smith")
})

test(`Selecting a row, then shrinking rows via search does not crash`, async ({
  page,
}) => {
  // Regression: when filtering replaced props.rows with a shorter array, the
  // first render still used the old selectedRow index, so the row detail
  // dialog crashed on rows[selectedRow] === undefined
  // ("Cannot read properties of undefined (reading '0')")
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  // Select the last row (row 50), then search so only 1 row remains
  await page.locator('[data-column="Name"]').last().click()
  await page.getByTestId("searchInput").fill("John Doe")
  await expect(page.getByTestId("filterExplanationTrigger")).toHaveText(
    "1 filtered",
  )

  // The table (and the whole app) must still be alive
  await expect(page.getByTestId("DataTable")).toBeVisible()
  expect(pageErrors).toEqual([])
})

for (const clipboardScenario of [
  {
    title: "Copy individual value",
    clickTestId: "rowDetailCopy_1_Name",
    expected: "John Doe",
  },
  {
    title: "Copy full row as TSV",
    clickTestId: "btnRowCopyTsv",
    expected:
      '1\tJohn Doe\t29\tjohndoe@example.com\t555-1234\tUSA\tNew York\tSoftware Engineer\tTechCorp\t85000\t8\t😊\t2020-01-15\t150.75\tBlue\tYes\tDog\t2\tItalian\t["TEST value with quotes"]',
  },
  {
    title: "Copy full row as JSON",
    clickTestId: "btnRowCopyJson",
    expected: JSON.stringify(
      {
        ID: "1",
        Name: "John Doe",
        Age: "29",
        Email: "johndoe@example.com",
        "Phone Number": "555-1234",
        Country: "USA",
        City: "New York",
        "Job Title": "Software Engineer",
        Company: "TechCorp",
        Salary: "85000",
        "Happiness Score": "8",
        "Favorite Emoji": "😊",
        "Date Joined": "2020-01-15",
        "Last Purchase Amount": "150.75",
        "Favorite Color": "Blue",
        "Has Pet": "Yes",
        "Pet Type": "Dog",
        "Number of Siblings": "2",
        "Favorite Cuisine": "Italian",
        Notes: '["TEST value with quotes"]',
      },
      null,
      2,
    ),
  },
  {
    title: "Copy full row as Key: Value",
    clickTestId: "btnRowCopyKv",
    expected:
      "ID: 1\n" +
      "Name: John Doe\n" +
      "Age: 29\n" +
      "Email: johndoe@example.com\n" +
      "Phone Number: 555-1234\n" +
      "Country: USA\n" +
      "City: New York\n" +
      "Job Title: Software Engineer\n" +
      "Company: TechCorp\n" +
      "Salary: 85000\n" +
      "Happiness Score: 8\n" +
      "Favorite Emoji: 😊\n" +
      "Date Joined: 2020-01-15\n" +
      "Last Purchase Amount: 150.75\n" +
      "Favorite Color: Blue\n" +
      "Has Pet: Yes\n" +
      "Pet Type: Dog\n" +
      "Number of Siblings: 2\n" +
      "Favorite Cuisine: Italian\n" +
      'Notes: ["TEST value with quotes"]',
  },
]) {
  test(clipboardScenario.title, async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit",
      "Webkit seems not to implement clipboard read",
    )
    await page.locator('[data-column="Name"]').first().dblclick()
    await page.getByTestId(clipboardScenario.clickTestId).click()
    const text = await waitForClipboard(page)
    expect(text).toBe(clipboardScenario.expected)
  })
}
