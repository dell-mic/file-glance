import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { AiManager } from "@/ai/aiManager"
import type { AiWorkerInput, AiWorkerOutput } from "@/ai/aiWorkerProtocol"

class FakeWorker {
  static instances: FakeWorker[] = []
  sent: AiWorkerInput[] = []
  onmessage: ((event: MessageEvent<AiWorkerOutput>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminated = false
  private listeners = new Set<(event: MessageEvent<AiWorkerOutput>) => void>()

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(msg: AiWorkerInput) {
    this.sent.push(msg)
  }

  addEventListener(_type: string, fn: any) {
    this.listeners.add(fn)
  }

  removeEventListener(_type: string, fn: any) {
    this.listeners.delete(fn)
  }

  terminate() {
    this.terminated = true
  }

  emit(data: AiWorkerOutput) {
    const event = { data } as MessageEvent<AiWorkerOutput>
    this.onmessage?.(event)
    for (const fn of [...this.listeners]) fn(event)
  }

  crash(message = "GPU context lost") {
    this.onerror?.({ message } as ErrorEvent)
  }
}

const origWorker = globalThis.Worker

beforeEach(() => {
  FakeWorker.instances = []
  ;(globalThis as any).Worker = FakeWorker
})

afterEach(() => {
  globalThis.Worker = origWorker
})

describe("AiManager", () => {
  test("tracks loading progress, transitions to ready, and streams chunks", async () => {
    const mgr = new AiManager()
    const readyPromise = mgr.ensureReady()
    expect(mgr.status).toBe("loading")
    const worker = FakeWorker.instances[0]
    expect(worker.sent).toEqual([{ type: "init" }])

    worker.emit({ type: "progress", progress: 0.5, text: "50%" })
    expect(mgr.loadProgress).toEqual({ progress: 0.5, text: "50%" })

    worker.emit({ type: "ready" })
    await readyPromise
    expect(mgr.status).toBe("ready")
    expect(mgr.loadProgress).toBeNull()

    const chunks: string[] = []
    const genPromise = mgr.generate(
      [{ role: "user", content: "hi" }],
      (chunk) => chunks.push(chunk),
    )
    const genMsg = worker.sent[1] as Extract<
      AiWorkerInput,
      { type: "generate" }
    >
    worker.emit({ type: "chunk", id: genMsg.id, text: "return " })
    worker.emit({ type: "chunk", id: genMsg.id, text: "value" })
    worker.emit({ type: "done", id: genMsg.id, text: "return value" })

    expect(await genPromise).toBe("return value")
    expect(chunks).toEqual(["return ", "value"])
  })

  test("recovers on retry after initError", async () => {
    const mgr = new AiManager()
    const first = mgr.ensureReady()
    FakeWorker.instances[0].emit({ type: "initError", error: "no adapter" })
    await expect(first).rejects.toThrow("no adapter")
    expect(mgr.status).toBe("error")

    const second = mgr.ensureReady()
    expect(FakeWorker.instances[0].terminated).toBe(true)
    FakeWorker.instances[1].emit({ type: "ready" })
    await second
    expect(mgr.status).toBe("ready")
  })

  test("rejects pending generate when worker crashes", async () => {
    const mgr = new AiManager()
    const ready = mgr.ensureReady()
    const worker = FakeWorker.instances[0]
    worker.emit({ type: "ready" })
    await ready

    const gen = mgr.generate([{ role: "user", content: "hi" }])
    worker.crash("OOM")
    await expect(gen).rejects.toThrow("OOM")
    expect(mgr.status).toBe("error")
  })
})
