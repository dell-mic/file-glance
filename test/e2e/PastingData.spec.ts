import { test, expect } from "@playwright/test"

const testData = {
  tsv: `ID\tName\tScore\n1\tAlice\t85\n2\tBob\t92\n3\tCharlie\t78\n4\tDiana\t88`,

  json: `[
    {"title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "published": 1925},
    {"title": "To Kill a Mockingbird", "author": "Harper Lee", "published": 1960},
    {"title": "1984", "author": "George Orwell", "published": 1949},
    {"title": "Moby Dick", "author": "Herman Melville", "published": 1851}
  ]`,

  markdown: `| City      | Country    | Population |\n|-----------|------------|------------|\n| New York  | USA        | 8.4M       |\n| Tokyo     | Japan      | 37.4M      |\n| Berlin    | Germany    | 3.6M       |\n| Nairobi   | Kenya      | 4.4M       |`,
}

test.describe("Pasting data test", () => {
  // Avoid interference with other tests when manipulating clipboard
  test.describe.configure({ mode: "serial" })

  // test.beforeEach(async ({ page }) => {
  //   console.log("Loading ...")

  // })

  Object.entries(testData).forEach(([format, data]) => {
    test(`should paste ${format.toUpperCase()} data into the page`, async ({
      page,
    }) => {
      // const context = await browser.newContext({
      //   permissions: ["clipboard-write"],
      // })
      // const page = await context.newPage()

      await page.goto("http://localhost:3000/")
      // await page.evaluate(() => location.reload(true))
      await page.getByTestId("fileInput").isVisible()
      await page.getByTestId("dataTable").isHidden()

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          console.error(`Error text: "${msg.text()}"`)
        }
      })
      page.on("pageerror", (exception) => {
        console.error(`Uncaught exception: "${exception}"`)
      })

      // // Focus on the input area where the data will be pasted
      await page.locator("main").click({ position: { x: 50, y: 50 } })

      // Simulate pasting the data by writing to the clipboard
      await page.evaluate(async (data) => {
        await navigator.clipboard.writeText(data)
      }, data)

      await page.keyboard.press("ControlOrMeta+V")

      // Optionally, take a screenshot after pasting
      await expect(page).toHaveScreenshot()
    })
  })
})
