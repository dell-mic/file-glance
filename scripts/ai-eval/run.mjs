// Orchestrates the AI eval: serves the built harness, opens it in headed
// Chromium (WebGPU needs a real GPU surface; headless has no WebGPU), and
// runs the matrix  {1.5b,3b} x {baseline,example}. Requires the harness to
// be built first (see commands in run --help output / README in this dir).
// Usage: node scripts/ai-eval/run.mjs [--headed=false]

import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const dir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(dir, "dist")
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`)
  const filePath = path.join(
    distDir,
    url.pathname === "/" ? "harness.html" : url.pathname,
  )
  try {
    const data = await readFile(filePath)
    res.writeHead(200, {
      "content-type":
        mime[path.extname(filePath)] ?? "application/octet-stream",
    })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end("not found")
  }
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const port = server.address().port
console.log(`serving ${distDir} on :${port}`)

const matrix = [
  { label: "1.5b-baseline", query: "model=1.5b&example=0" },
  { label: "1.5b-example", query: "model=1.5b&example=1" },
  { label: "3b-baseline", query: "model=3b&example=0" },
  { label: "3b-example", query: "model=3b&example=1" },
]

// Persistent profile: ephemeral Playwright contexts have a tiny Cache-API
// quota (the 3B model's 1.8 GB download hits QuotaExceededError), and the
// profile also keeps the downloaded models across runs.
const userDataDir = path.join(dir, ".profile")
const only = process.argv[2] // optional substring filter, e.g. "3b"
const matrixFiltered = only
  ? matrix.filter((m) => m.label.includes(only))
  : matrix
const headless = process.argv.includes("--headless")
const context = await chromium.launchPersistentContext(userDataDir, {
  headless,
})
const page = context.pages()[0] ?? (await context.newPage())
page.on("console", (msg) => {
  const text = msg.text()
  if (
    text.includes("[AI]") ||
    text.includes("error") ||
    text.includes("Error")
  ) {
    console.log(`[page] ${text}`)
  }
})

await mkdir(path.join(dir, "results"), { recursive: true })
for (const combo of matrixFiltered) {
  console.log(`\n=== ${combo.label} ===`)
  await page.goto(`http://127.0.0.1:${port}/harness.html?${combo.query}`)
  try {
    await page.waitForFunction(() => window.__evalDone, undefined, {
      timeout: 45 * 60 * 1000,
    })
  } catch {
    console.error(`TIMEOUT waiting for ${combo.label}`)
    continue
  }
  const outcome = await page.evaluate(() => window.__evalDone)
  const file = path.join(dir, "results", `${combo.label}.json`)
  await writeFile(file, JSON.stringify(outcome, null, 2))
  console.log(
    `${combo.label}: ${outcome.passCount}/${outcome.total} passed, ` +
      `load ${Number(outcome.loadSeconds).toFixed(0)}s, ` +
      `avg ${(outcome.avgDurationMs / 1000).toFixed(1)}s/task` +
      (outcome.loadError ? `, LOAD ERROR: ${outcome.loadError}` : ""),
  )
}

await context.close()
server.close()
console.log("\nAll done. Results in scripts/ai-eval/results/")
