// Main-thread singleton around the AI worker. Owns the opt-in state and
// exposes a small provider-agnostic API so the UI never touches WebLLM
// directly (a future BYOK backend can implement the same calls).

import {
  aiOptInStorageKey,
  type AiMessage,
  type AiWorkerInput,
  type AiWorkerOutput,
} from "@/ai/aiWorkerProtocol"

export type AiStatus =
  "unsupported" | "disabled" | "loading" | "ready" | "error"

type Progress = { progress: number; text: string }

class AiManager {
  private worker: Worker | null = null
  private workerReady: Promise<void> | null = null
  private listeners = new Set<() => void>()
  private generateId = 0
  private chunkHandlers = new Map<number, (text: string) => void>()
  private generateResolvers = new Map<
    number,
    { resolve: (code: string) => void; reject: (err: Error) => void }
  >()
  private workerReadyReject: ((err: Error) => void) | null = null

  status: AiStatus = "disabled"
  loadProgress: Progress | null = null
  errorMessage: string | null = null

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator
  }

  hasOptedIn(): boolean {
    return localStorage.getItem(aiOptInStorageKey) === "true"
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Called when the user accepts the opt-in dialog. Resolves once the model is usable. */
  optIn = (): Promise<void> => {
    localStorage.setItem(aiOptInStorageKey, "true")
    // The ~1 GB model cache in Cache Storage is otherwise best-effort storage,
    // which Chrome may evict under disk pressure.
    navigator.storage?.persist().catch(() => {})
    return this.ensureReady()
  }

  /** Spawns the worker and loads the model if not done yet. Idempotent. */
  ensureReady = (): Promise<void> => {
    if (this.status === "ready") return Promise.resolve()
    if (this.status === "error") this.resetWorker()
    if (this.workerReady) return this.workerReady

    this.status = "loading"
    this.errorMessage = null
    this.notify()

    this.worker = new Worker(new URL("../worker/aiWorker.ts", import.meta.url))
    this.worker.onmessage = (event: MessageEvent<AiWorkerOutput>) =>
      this.handleWorkerMessage(event.data)
    // A crashed worker (e.g. OOM/GPU context loss) posts no message; without
    // this, pending generations would never settle and the UI stays "generating"
    this.worker.onerror = (event) => this.handleWorkerError(event)

    this.workerReady = new Promise<void>((resolve, reject) => {
      this.workerReadyReject = reject
      const onMessage = (event: MessageEvent<AiWorkerOutput>) => {
        const message = event.data
        if (message.type === "ready") {
          this.worker?.removeEventListener("message", onMessage)
          this.status = "ready"
          this.loadProgress = null
          this.workerReadyReject = null
          this.notify()
          resolve()
        } else if (message.type === "initError") {
          this.worker?.removeEventListener("message", onMessage)
          this.status = "error"
          this.errorMessage = message.error
          this.workerReadyReject = null
          this.notify()
          reject(new Error(message.error))
        } else if (message.type === "progress") {
          this.loadProgress = {
            progress: message.progress,
            text: message.text,
          }
          this.notify()
        }
      }
      this.worker!.addEventListener("message", onMessage)
    })
    this.postToWorker({ type: "init" })
    return this.workerReady
  }

  /** Streams tokens via onChunk; resolves with the full generated text. */
  generate = (
    messages: AiMessage[],
    onChunk?: (text: string) => void,
  ): Promise<string> => {
    if (!this.worker || this.status !== "ready") {
      return Promise.reject(new Error("AI is not ready"))
    }
    const id = ++this.generateId
    if (onChunk) this.chunkHandlers.set(id, onChunk)
    return new Promise<string>((resolve, reject) => {
      this.generateResolvers.set(id, { resolve, reject })
      this.postToWorker({ type: "generate", id, messages })
    })
  }

  interrupt = () => {
    this.postToWorker({ type: "interrupt" })
  }

  private postToWorker(message: AiWorkerInput) {
    this.worker?.postMessage(message)
  }

  private resetWorker() {
    this.worker?.terminate()
    this.worker = null
    this.workerReady = null
    this.workerReadyReject = null
  }

  private handleWorkerError(event: ErrorEvent) {
    const message = event.message || "AI worker crashed"
    const error = new Error(message)
    this.workerReadyReject?.(error)
    this.resetWorker()
    this.status = "error"
    this.errorMessage = message
    for (const resolver of this.generateResolvers.values())
      resolver.reject(error)
    this.generateResolvers.clear()
    this.chunkHandlers.clear()
    this.notify()
  }

  private handleWorkerMessage(message: AiWorkerOutput) {
    if (message.type === "chunk") {
      this.chunkHandlers.get(message.id)?.(message.text)
    } else if (message.type === "done") {
      this.chunkHandlers.delete(message.id)
      this.generateResolvers.get(message.id)?.resolve(message.text)
      this.generateResolvers.delete(message.id)
    } else if (message.type === "generateError") {
      this.chunkHandlers.delete(message.id)
      this.generateResolvers.get(message.id)?.reject(new Error(message.error))
      this.generateResolvers.delete(message.id)
    }
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }
}

export const aiManager = new AiManager()
