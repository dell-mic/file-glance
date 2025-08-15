import { test, expect } from "@playwright/test"
import { stringToBase64Gzipped } from "../../src/utils"

const sampleCsv = "ID,Name,Age\n1,Alice,30\n2,Bob,25"
const DATA_TABLE_SELECTOR = '[data-testid="DataTable"]'
const DATA_CONTENT_WRAPPER_SELECTOR = '[data-testid="DataContentWrapper"]'

const host = "http://localhost:3000/"

test("parses #d= URI encoded CSV data", async ({ page }) => {
  const targetUrl = host + "#d=" + encodeURI(sampleCsv)
  // console.log(targetUrl)
  await page.goto(targetUrl)
  await page.waitForSelector(DATA_TABLE_SELECTOR, { state: "visible" })
  const wrapper = page.locator(DATA_CONTENT_WRAPPER_SELECTOR)
  await expect(wrapper).toHaveScreenshot()
})

test("parses #d= URI encoded JSON data", async ({ page }) => {
  const jsonArray = JSON.stringify([
    { ID: 1, Name: "Alice", Age: 30 },
    { ID: 2, Name: "Bob", Age: 25 },
  ])
  const targetUrl = host + "#d=" + encodeURI(jsonArray)
  // console.log(targetUrl)
  await page.goto(targetUrl)
  await page.waitForSelector(DATA_TABLE_SELECTOR, { state: "visible" })
  const wrapper = page.locator(DATA_CONTENT_WRAPPER_SELECTOR)
  await expect(wrapper).toHaveScreenshot()
})

test("parses #c= base64 gzipped data", async ({ page }) => {
  const base64Gzipped = await stringToBase64Gzipped(sampleCsv)
  const targetUrl = host + "#c=" + base64Gzipped
  await page.goto(targetUrl)
  await page.waitForSelector(DATA_TABLE_SELECTOR, { state: "visible" })
  const wrapper = page.locator(DATA_CONTENT_WRAPPER_SELECTOR)
  await expect(wrapper).toHaveScreenshot()
})
