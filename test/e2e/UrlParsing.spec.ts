import { test, expect } from "@playwright/test"
import zlib from "zlib"
import { stringToBase64Gzipped } from "../../src/utils"

// Test string to test proper encoding/decoding
const specialChars = "!\"#$%&'()*+-./:;<=>?@[\\]^_`{|}~"
const NameWithSpecialCharts = "Bob#❤️" + specialChars

const sampleCsv = `ID,Name,Age\n1,Alice,30\n2,${NameWithSpecialCharts},25`
const sampleJson = JSON.stringify([
  { ID: 1, Name: "Alice", Age: 30 },
  { ID: 2, Name: NameWithSpecialCharts, Age: 25 },
])

const DATA_TABLE_SELECTOR = '[data-testid="DataTable"]'
const DATA_CONTENT_WRAPPER_SELECTOR = '[data-testid="DataContentWrapper"]'

const host = "http://localhost:3000/"

test("parses #d= URI encoded CSV data", async ({ page }) => {
  const targetUrl = host + "#d=" + encodeURI(sampleCsv)
  // console.log(targetUrl)
  await page.goto(targetUrl)
  await page.waitForSelector(DATA_TABLE_SELECTOR, { state: "visible" })
  const wrapper = page.locator(DATA_CONTENT_WRAPPER_SELECTOR)

  await expect(page.getByText(NameWithSpecialCharts)).toBeVisible()
  await expect(wrapper).toHaveScreenshot()
})

test("parses #d= URI encoded JSON data", async ({ page }) => {
  const targetUrl = host + "#d=" + encodeURI(sampleJson)
  // console.log(targetUrl)
  await page.goto(targetUrl)
  await page.waitForSelector(DATA_TABLE_SELECTOR, { state: "visible" })
  const wrapper = page.locator(DATA_CONTENT_WRAPPER_SELECTOR)

  await expect(page.getByText(NameWithSpecialCharts)).toBeVisible()
  await expect(wrapper).toHaveScreenshot()
})

test("parses #d= BASE64/JSON data", async ({ page }) => {
  const encodedData = Buffer.from(sampleJson, "utf8").toString("base64")
  const targetUrl = host + "#d=" + encodedData
  // console.log(targetUrl)
  await page.goto(targetUrl)
  await page.waitForSelector(DATA_TABLE_SELECTOR, { state: "visible" })
  const wrapper = page.locator(DATA_CONTENT_WRAPPER_SELECTOR)

  await expect(page.getByText(NameWithSpecialCharts)).toBeVisible()
  await expect(wrapper).toHaveScreenshot()
})

test("parses #c= base64 gzipped data", async ({ page }) => {
  const base64Gzipped = await stringToBase64Gzipped(sampleCsv)
  const targetUrl = host + "#c=" + base64Gzipped
  await page.goto(targetUrl)
  await page.waitForSelector(DATA_TABLE_SELECTOR, { state: "visible" })
  const wrapper = page.locator(DATA_CONTENT_WRAPPER_SELECTOR)

  await expect(page.getByText(NameWithSpecialCharts)).toBeVisible()
  await expect(wrapper).toHaveScreenshot()
})

test("parses #p= base64 gzipped minimal project", async ({ page }) => {
  const base64Gzipped = zlib
    .gzipSync(
      JSON.stringify({
        v: 2,
        name: "minimal project.json",
        data: sampleJson,
      }),
    )
    .toString("base64")
  const targetUrl = host + "#p=" + base64Gzipped
  // console.log(targetUrl)
  await page.goto(targetUrl)
  await page.waitForSelector(DATA_TABLE_SELECTOR, { state: "visible" })

  await expect(page.getByText(NameWithSpecialCharts)).toBeVisible()
  await expect(page).toHaveScreenshot()
  // Check document title includes the project name
  await expect(page).toHaveTitle(/minimal project\.json/i)
})
