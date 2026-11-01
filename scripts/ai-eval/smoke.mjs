import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import path from "node:path"

const distDir = path.resolve("scripts/ai-eval/dist")
const server = createServer(async (req, res) => {
  const p = path.join(
    distDir,
    req.url === "/" ? "harness.html" : req.url.split("?")[0],
  )
  try {
    const data = await readFile(p)
    res.writeHead(200, {
      "content-type": p.endsWith(".js") ? "text/javascript" : "text/html",
    })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((r) => server.listen(0, "127.0.0.1", r))
const port = server.address().port
const browser = await chromium.launch({ headless: false })
const page = await (await browser.newContext()).newPage()
page.on("console", (m) => console.log("[page]", m.text().slice(0, 200)))
await page.goto(`http://127.0.0.1:${port}/harness.html?model=1.5b&example=0`)
try {
  await page.waitForFunction(() => window.__evalDone, undefined, {
    timeout: 15 * 60 * 1000,
  })
  const o = await page.evaluate(() => window.__evalDone)
  console.log(
    "SMOKE:",
    o.loadError
      ? `load error: ${o.loadError}`
      : `${o.passCount}/${o.total} passed, load ${o.loadSeconds.toFixed(0)}s`,
  )
} catch {
  console.log("SMOKE: timeout waiting for evalDone")
}
await browser.close()
server.close()
