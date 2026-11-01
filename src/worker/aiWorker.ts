// Web Worker hosting the WebLLM engine, so inference never blocks the UI.
// The library is imported dynamically inside the handler: the worker chunk
// (and the multi-MB WebLLM code) is only downloaded once AI is actually used.

import type { AiWorkerInput } from "@/ai/aiWorkerProtocol"
import { aiModelId } from "@/ai/aiWorkerProtocol"

type WebLLMModule = typeof import("@mlc-ai/web-llm")

let webllm: WebLLMModule | null = null
let engine: import("@mlc-ai/web-llm").MLCEngine | null = null

addEventListener("message", (event: MessageEvent<AiWorkerInput>) => {
  void handleMessage(event.data)
})

async function handleMessage(message: AiWorkerInput) {
  switch (message.type) {
    case "init": {
      try {
        if (!engine) {
          const startedAt = performance.now()
          console.info(`[AI] Model download started: ${aiModelId}`)
          // Shard index -> largest "loaded MB" seen, to estimate total bytes
          // fetched from the progress text ("... [58MB/1024MB], 12 MB/s").
          const shardLoadedMB = new Map<number, number>()
          webllm = await import("@mlc-ai/web-llm")
          engine = await webllm.CreateMLCEngine(aiModelId, {
            initProgressCallback: (report) => {
              const match = report.text.match(
                /cache\[(\d+)\/\d+\].*?\[([\d.]+)MB\/[\d.]+MB\]/,
              )
              if (match) {
                const shardIndex = Number(match[1])
                const loadedMB = Number(match[2])
                shardLoadedMB.set(
                  shardIndex,
                  Math.max(shardLoadedMB.get(shardIndex) ?? 0, loadedMB),
                )
              }
              postMessage({
                type: "progress",
                progress: report.progress,
                text: report.text,
              })
            },
          })
          postMessage({ type: "ready" })
          const seconds = ((performance.now() - startedAt) / 1000).toFixed(1)
          const fetchedMB = Array.from(shardLoadedMB.values()).reduce(
            (sum, mb) => sum + mb,
            0,
          )
          console.info(
            fetchedMB > 0
              ? `[AI] Model download finished: ${aiModelId} in ${seconds}s, ~${(fetchedMB / 1024).toFixed(2)} GB downloaded`
              : `[AI] Model load finished: ${aiModelId} in ${seconds}s (no download observed, likely from cache)`,
          )
        } else {
          postMessage({ type: "ready" })
          console.info(`[AI] Model already loaded: ${aiModelId}`)
        }
      } catch (err: any) {
        engine = null
        postMessage({
          type: "initError",
          error: err?.toString() ?? String(err),
        })
      }
      break
    }
    case "generate": {
      if (!engine) {
        postMessage({
          type: "generateError",
          id: message.id,
          error: "AI engine is not initialized",
        })
        break
      }
      try {
        const stream = await engine.chat.completions.create({
          messages: message.messages,
          stream: true,
          temperature: 0.2,
          max_tokens: 1024,
        })
        let full = ""
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? ""
          if (delta) {
            full += delta
            postMessage({ type: "chunk", id: message.id, text: delta })
          }
        }
        postMessage({ type: "done", id: message.id, text: full })
      } catch (err: any) {
        postMessage({
          type: "generateError",
          id: message.id,
          error: err?.toString() ?? String(err),
        })
      }
      break
    }
    case "interrupt": {
      engine?.interruptGenerate()
      break
    }
  }
}
