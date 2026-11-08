// Shared UI + state machine for on-device AI code generation, used by the
// transform and filter dialogs: prompt input, opt-in/download flow, streaming
// into the code editor, and the "Fix with AI" retry button.

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/Modal"
import { SparklesIcon, StopIcon } from "@heroicons/react/20/solid"
import { aiManager, type AiStatus } from "@/ai/aiManager"
import {
  extractCode,
  stripOpeningFence,
  type FixContext,
} from "@/ai/transformerPrompt"
import type { AiMessage } from "@/ai/aiWorkerProtocol"

interface AiCodeRowProps {
  /** Prefix for test ids and the opt-in modal id */
  idPrefix: string
  placeholder: string
  buildMessages: (instruction: string, previous?: FixContext) => AiMessage[]
  onCodeChange: (code: string) => void
  /** Signals when generation starts/stops, so validation can be suppressed
   * while intermediate code is streaming in */
  onGeneratingChange?: (generating: boolean) => void
  /** When set (code + validation error), makes the fix trigger available via
   * fixTriggerRef, so callers can show a "Fix with AI" button next to the
   * validation error instead of up here in the prompt row */
  fix?: { code: string; error: string } | null
  /** Receives the fix trigger; null while no fix run is possible (no error, or
   * a generation already in flight) */
  fixTriggerRef?: React.RefObject<(() => void) | null>
}

const AiCodeRow: React.FC<AiCodeRowProps> = ({
  idPrefix,
  placeholder,
  buildMessages,
  onCodeChange,
  onGeneratingChange,
  fix,
  fixTriggerRef,
}) => {
  const [aiStatus, aiLoadProgress] = useAiManagerState()
  const [prompt, setPrompt] = React.useState("")
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [optInOpen, setOptInOpen] = React.useState(false)
  const pending = React.useRef<{
    instruction: string
    previous?: FixContext
  } | null>(null)
  const mounted = React.useRef(true)
  const generatingRef = React.useRef(false)
  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // Stop the in-flight generation so the model does not keep running
      // after the dialog closed
      if (generatingRef.current) aiManager.interrupt()
    }
  }, [])
  // Last instruction that produced AI code, so "Fix with AI" can keep the
  // original intent. May be stale if the code was edited since — the error
  // text still dominates the fix prompt.
  const lastInstruction = React.useRef<string | null>(null)
  // Assigned on every render so the closure always sees the latest fix/generating
  React.useEffect(() => {
    if (!fixTriggerRef) return
    fixTriggerRef.current =
      fix && !generating
        ? () =>
            requestAi("Fix the code", {
              ...fix,
              instruction: lastInstruction.current ?? undefined,
            })
        : null
  })

  const runGeneration = async (
    instruction: string,
    previous?: { code: string; error: string },
  ) => {
    setGenerating(true)
    onGeneratingChange?.(true)
    generatingRef.current = true
    setError(null)
    // Fix runs pass "Fix the code" as instruction — keep the last real one
    if (!previous) lastInstruction.current = instruction
    let accumulated = ""
    let lastFlush = 0
    // Stream into the editor right away, but throttle validation-triggering
    // updates and re-extract only once the full answer is in.
    const flush = () => {
      const stripped = stripOpeningFence(accumulated)
      if (stripped) onCodeChange(stripped)
    }
    try {
      const full = await aiManager.generate(
        buildMessages(instruction, previous),
        (chunk) => {
          if (!mounted.current) return
          accumulated += chunk
          const now = Date.now()
          if (now - lastFlush > 150) {
            lastFlush = now
            flush()
          }
        },
      )
      const code = extractCode(full)
      if (mounted.current && code) onCodeChange(code)
    } catch (err: any) {
      if (mounted.current) setError(err?.message ?? String(err))
    } finally {
      generatingRef.current = false
      // Fires even after unmount so the parent's suppression can't get stuck
      onGeneratingChange?.(false)
      if (mounted.current) setGenerating(false)
    }
  }

  const startPendingGeneration = () => {
    if (!pending.current) return
    void aiManager
      .ensureReady()
      .then(() => {
        const next = pending.current
        if (!next || !mounted.current) return
        pending.current = null
        setOptInOpen(false)
        void runGeneration(next.instruction, next.previous)
      })
      .catch(() => {
        // Error is surfaced via aiStatus/error in the opt-in dialog
      })
  }

  const closeOptIn = () => {
    pending.current = null
    setOptInOpen(false)
  }

  const requestAi = (instruction: string, previous?: FixContext) => {
    // An empty instruction would make the model emit something arbitrary and
    // overwrite the user's code.
    if (!instruction) return
    if (aiStatus === "ready") {
      void runGeneration(instruction, previous)
    } else {
      pending.current = { instruction, previous }
      setOptInOpen(true)
      // Already opted in earlier: skip the confirmation, show progress instead
      if (aiManager.hasOptedIn()) startPendingGeneration()
    }
  }

  const handleOptIn = () => {
    // ensureReady() rejects on init errors; the dialog surfaces the error via
    // status, the rejection itself would just be unhandled-promise noise.
    aiManager.optIn().catch(() => {})
    startPendingGeneration()
  }

  // No WebGPU: the AI flow cannot work here, so don't offer it at all
  // (instead of a dialog whose download ends in a cryptic init error).
  if (!aiManager.isSupported()) return null

  return (
    <>
      <div className="flex items-center gap-2 my-2">
        <Input
          data-testid={`${idPrefix}PromptInput`}
          value={prompt}
          disabled={generating}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !generating) {
              e.preventDefault()
              requestAi(prompt.trim())
            }
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        {generating ? (
          <Button
            data-testid={`${idPrefix}Stop`}
            variant="ghost"
            size="sm"
            onPointerDown={() => aiManager.interrupt()}
          >
            <StopIcon className="w-4 h-4 mr-1" />
            Stop
          </Button>
        ) : (
          <Button
            data-testid={`${idPrefix}Generate`}
            size="sm"
            onPointerDown={() => requestAi(prompt.trim())}
          >
            <SparklesIcon className="w-4 h-4 mr-1" />
            Generate
          </Button>
        )}
      </div>
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
      {optInOpen && (
        <Modal
          id={`${idPrefix}OptInDialog`}
          closeOnClickOutside={false}
          onClose={closeOptIn}
          className="max-w-md"
        >
          <div className="p-4">
            <h2 className="text-2xl text-gray-700 mb-3">Enable on-device AI</h2>
            <p className="text-sm text-gray-700 mb-2">
              Generates code with a small AI model running entirely in your
              browser. Your data never leaves your device.
            </p>
            <p className="text-sm text-gray-700 mb-4">
              One-time download of about 1 GB, stored by your browser.
            </p>
            {aiStatus === "loading" && (
              <div className="mb-4">
                <div className="h-2 bg-gray-200 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{
                      width: `${Math.round((aiLoadProgress?.progress ?? 0) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {aiLoadProgress?.text}
                </div>
              </div>
            )}
            {aiStatus === "error" && (
              <div className="text-red-600 text-sm mb-4">
                Loading failed: {aiManager.errorMessage}
              </div>
            )}
            <div className="flex justify-end gap-4">
              <Button
                data-testid={`${idPrefix}OptInCancel`}
                variant="ghost"
                onPointerDown={closeOptIn}
              >
                Not now
              </Button>
              {aiStatus === "error" ? (
                <Button
                  data-testid={`${idPrefix}Retry`}
                  onPointerDown={handleOptIn}
                >
                  Try again
                </Button>
              ) : (
                <Button
                  data-testid={`${idPrefix}OptIn`}
                  disabled={aiStatus === "loading"}
                  onPointerDown={handleOptIn}
                >
                  Download &amp; enable
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

function useAiManagerState(): [
  AiStatus,
  { progress: number; text: string } | null,
] {
  const status = React.useSyncExternalStore(
    aiManager.subscribe,
    () => aiManager.status,
  )
  const loadProgress = React.useSyncExternalStore(
    aiManager.subscribe,
    () => aiManager.loadProgress,
  )
  return [status, loadProgress]
}

export default AiCodeRow
