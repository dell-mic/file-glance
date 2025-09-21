import { tryParseJSONObject } from "@/utils"
import { uniq } from "lodash-es"
import React, { useCallback, useEffect, useRef, useState } from "react"
import SimpleEditor from "react-simple-code-editor"

type EditorProps = React.ComponentProps<typeof SimpleEditor> & {
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>
  localStorageHistoryKey?: string | null
  maxHistoryEntries?: number
}

function Editor({
  value,
  onValueChange,
  localStorageHistoryKey,
  maxHistoryEntries = 50,
  onBlur,
  onKeyDown,
  ref,
  ...rest
}: EditorProps) {
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [preHistoryValue, setPreHistoryValue] = useState<string>("")
  const valueRef = useRef(value)

  //   useEffect(() => {
  //     setHistoryIndex(null)
  //     setPreHistoryValue("")
  //   }, [])

  // Handle up/down arrow for history navigation
  const handleKeyDown: React.KeyboardEventHandler = (e) => {
    if (onKeyDown) {
      onKeyDown(e as React.KeyboardEvent<HTMLDivElement>)
    }

    if (!localStorageHistoryKey || history.length === 0) return

    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (historyIndex === null) {
        setPreHistoryValue(valueRef.current)
        setHistoryIndex(0)
        onValueChange(history[0])
      } else if (historyIndex < history.length - 1) {
        setHistoryIndex(historyIndex + 1)
        onValueChange(history[historyIndex + 1])
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex === null) return
      if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1)
        onValueChange(history[historyIndex - 1])
      } else {
        setHistoryIndex(null)
        onValueChange(preHistoryValue)
        setPreHistoryValue("")
      }
    }
  }

  const saveToHistory = useCallback(
    (newValue: string) => {
      if (!localStorageHistoryKey) return
      if (!newValue || newValue.trim() === "") return
      let existingHistory: string[] = []

      try {
        existingHistory =
          tryParseJSONObject(
            localStorage.getItem(localStorageHistoryKey) || "[]",
          ) || []

        if (existingHistory[0] !== newValue) {
          existingHistory.unshift(newValue)
          const updatedHistory = uniq(existingHistory).slice(
            0,
            maxHistoryEntries,
          )
          localStorage.setItem(
            localStorageHistoryKey,
            JSON.stringify(updatedHistory),
          )
          setHistory(updatedHistory)
        }
      } catch (error) {
        // Catch all, but just log errors, such that this never actually has user impact when failing
        console.error(error)
        setHistory([])
      }
    },
    [localStorageHistoryKey, maxHistoryEntries],
  )

  // save on blur
  const handleBlur: React.FocusEventHandler<HTMLTextAreaElement> &
    React.FocusEventHandler<HTMLDivElement> = (e) => {
    saveToHistory(valueRef.current)
    setHistoryIndex(0)
    // TODO: Reason this expects FocusEvent<HTMLDivElement>?
    if (onBlur) onBlur(e as React.FocusEvent<HTMLDivElement>)
  }

  // Load history from localStorage on startup
  useEffect(() => {
    if (!localStorageHistoryKey) return
    const stored = tryParseJSONObject(
      localStorage.getItem(localStorageHistoryKey) || "[]",
    )
    setHistory(stored || [])

    // Also save last value on unmount (e.g. when modal is closed)
    return () => {
      saveToHistory(valueRef.current)
    }
  }, [localStorageHistoryKey, saveToHistory])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  return (
    <SimpleEditor
      ref={ref}
      value={value}
      onValueChange={onValueChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      {...rest}
    />
  )
}

export default Editor
