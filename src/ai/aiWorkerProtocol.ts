// Shared between the AI manager (main thread) and the AI worker. Deliberately
// free of any WebLLM imports so the (large) library stays out of the main
// bundle and is only pulled in by the worker chunk.

export const aiModelId = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC"

export type AiMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type AiWorkerInput =
  | { type: "init" }
  | { type: "generate"; id: number; messages: AiMessage[] }
  | { type: "interrupt" }

export type AiWorkerOutput =
  | { type: "progress"; progress: number; text: string }
  | { type: "ready" }
  | { type: "initError"; error: string }
  | { type: "chunk"; id: number; text: string }
  | { type: "done"; id: number; text: string }
  | { type: "generateError"; id: number; error: string }

export const aiOptInStorageKey = "aiOnDeviceOptIn"
