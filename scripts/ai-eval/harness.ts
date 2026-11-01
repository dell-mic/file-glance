// Browser harness: runs the transformer eval set against one WebLLM model,
// with or without the few-shot example. Scores through the app's own compile
// path. Started via run.mjs; results land in window.__evalDone.

import { evalTasks, scoreGeneratedCode, taskPromptContext } from "./evalSet"
import { compileTransformerCode } from "@/transformerCode"
import { buildTransformerMessages, extractCode } from "@/ai/transformerPrompt"

const params = new URLSearchParams(window.location.search)
const modelId =
  params.get("model") === "3b"
    ? "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC"
    : "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC"
const useExample = params.get("example") === "1"

interface TaskResult {
  id: string
  category: string
  pass: boolean
  error: string | null
  rawCode: string
  durationMs: number
  ttftMs: number | null
  chunks: number
}

interface EvalOutcome {
  modelId: string
  useExample: boolean
  loadSeconds: number
  loadError?: string
  passCount: number
  total: number
  avgDurationMs: number
  avgTtftMs: number
  avgTokensPerSecond: number
  categorySummary: Array<{ category: string; passed: number; total: number }>
  results: TaskResult[]
}

async function run() {
  const outcome: EvalOutcome = {
    modelId,
    useExample,
    loadSeconds: 0,
    passCount: 0,
    total: evalTasks.length,
    avgDurationMs: 0,
    avgTtftMs: 0,
    avgTokensPerSecond: 0,
    categorySummary: [],
    results: [],
  }
  const log = (text: string) => {
    document.getElementById("log")!.textContent += text + "\n"
  }
  document.title = `eval ${modelId} example=${useExample} …`
  log(`Model: ${modelId}, example: ${useExample}`)

  const loadStart = performance.now()
  let engine
  try {
    const webllm = await import("@mlc-ai/web-llm")
    engine = await webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => log(`  ${report.text}`),
    })
  } catch (err: any) {
    outcome.loadError = err?.toString() ?? String(err)
    log(`LOAD ERROR: ${outcome.loadError}`)
    ;(window as any).__evalDone = outcome
    return
  }
  outcome.loadSeconds = (performance.now() - loadStart) / 1000
  log(`Loaded in ${outcome.loadSeconds.toFixed(1)}s`)

  for (const task of evalTasks) {
    log(`▶ ${task.id}`)
    const messages = buildTransformerMessages(
      taskPromptContext(task),
      task.headerName,
      task.columnType,
      task.instruction,
      undefined,
      { example: useExample },
    )
    const startedAt = performance.now()
    let ttft: number | null = null
    let full = ""
    let chunks = 0
    let generateError: string | null = null
    try {
      const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.2,
        max_tokens: 1024,
      })
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ""
        if (delta) {
          if (ttft === null) ttft = performance.now() - startedAt
          full += delta
          chunks++
        }
      }
    } catch (err: any) {
      generateError = err?.toString() ?? String(err)
    }
    const durationMs = performance.now() - startedAt
    const code = extractCode(full) || full.trim()
    const scored = generateError
      ? { pass: false, error: generateError, sampleErrors: [] }
      : scoreGeneratedCode(code, task, compileTransformerCode)
    log(
      `  ${scored.pass ? "✅ PASS" : "❌ FAIL"} (${(durationMs / 1000).toFixed(1)}s)` +
        (scored.error ? ` — ${scored.error}` : "") +
        `\n  code: ${code.split("\n")[0]}`,
    )
    outcome.results.push({
      id: task.id,
      category: task.category,
      pass: scored.pass,
      error: scored.error ?? scored.sampleErrors.find((e) => e) ?? null,
      rawCode: code,
      durationMs,
      ttftMs: ttft,
      chunks,
    })
  }

  outcome.passCount = outcome.results.filter((r) => r.pass).length
  outcome.avgDurationMs =
    outcome.results.reduce((sum, r) => sum + r.durationMs, 0) /
    outcome.results.length
  const withTtft = outcome.results.filter((r) => r.ttftMs !== null)
  outcome.avgTtftMs =
    withTtft.reduce((sum, r) => sum + (r.ttftMs ?? 0), 0) /
    Math.max(1, withTtft.length)
  const totalChunks = outcome.results.reduce((sum, r) => sum + r.chunks, 0)
  const totalSeconds =
    outcome.results.reduce((sum, r) => sum + r.durationMs, 0) / 1000
  outcome.avgTokensPerSecond = totalChunks / Math.max(0.001, totalSeconds)
  outcome.categorySummary = ["text", "number", "logic"].map((category) => {
    const inCategory = outcome.results.filter((r) => r.category === category)
    return {
      category,
      passed: inCategory.filter((r) => r.pass).length,
      total: inCategory.length,
    }
  })

  log(
    `\nDONE: ${outcome.passCount}/${outcome.total} passed, avg ${(outcome.avgDurationMs / 1000).toFixed(1)}s/task, ~${outcome.avgTokensPerSecond.toFixed(0)} tok/s`,
  )
  for (const cat of outcome.categorySummary) {
    log(`  ${cat.category}: ${cat.passed}/${cat.total}`)
  }
  document.title = `eval ${modelId} example=${useExample} done`
  ;(window as any).__evalDone = outcome
}

void run()
