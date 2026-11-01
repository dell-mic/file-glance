// Re-scores the rawCode outputs stored in results/*.json with the current
// scorer — lets scoring changes be applied without re-running the models.
// Usage: bun scripts/ai-eval/rescore.ts

import { readFile, writeFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { evalTasks, scoreGeneratedCode } from "./evalSet"
import { compileTransformerCode } from "@/transformerCode"

const dir = path.dirname(fileURLToPath(import.meta.url))
const resultsDir = path.join(dir, "results")

for (const file of await readdir(resultsDir)) {
  if (!file.endsWith(".json")) continue
  const outcome = JSON.parse(
    await readFile(path.join(resultsDir, file), "utf8"),
  )
  const results: any[] = outcome.results
  for (const result of results) {
    const task = evalTasks.find((t) => t.id === result.id)
    if (!task) continue
    const scored = scoreGeneratedCode(
      result.rawCode,
      task,
      compileTransformerCode,
    )
    result.pass = scored.pass
    result.error = scored.error ?? scored.sampleErrors.find((e) => e) ?? null
  }
  outcome.passCount = outcome.results.filter((r: any) => r.pass).length
  outcome.categorySummary = ["text", "number", "logic"].map((category) => {
    const inCategory = outcome.results.filter(
      (r: any) => r.category === category,
    )
    return {
      category,
      passed: inCategory.filter((r: any) => r.pass).length,
      total: inCategory.length,
    }
  })
  await writeFile(path.join(resultsDir, file), JSON.stringify(outcome, null, 2))
  console.log(`${file}: ${outcome.passCount}/${outcome.total}`)
}
