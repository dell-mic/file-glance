"use client"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { uniq } from "lodash-es"
import type { BeforeMount, OnMount } from "@monaco-editor/react"
import type { editor as monacoEditor, Position } from "monaco-editor"
import MonacoEditor from "@/components/ui/MonacoEditor"
import { cn } from "@/lib/utils"
import { tryParseJSONObject } from "@/utils"

interface CodeEditorProps {
  value: string
  onValueChange: (value: string) => void
  /** Unique monaco model path, e.g. "inmemory://model/filter.js" */
  path: string
  className?: string
  "data-testid"?: string
  /** Shown (as an overlay) while the editor is empty. */
  placeholder?: string
  /** Fill the parent element (which must be sized) instead of auto-growing with the content. */
  fillContainer?: boolean
  /** Use a gray-100 editor background (used by the dialogs); default is white. */
  grayBackground?: boolean
  /** Vertical padding inside the editor in px (default 5). */
  contentPadding?: number
  localStorageHistoryKey?: string
  maxHistoryEntries?: number
  /** Type declarations for the variables in scope when the code is executed. */
  extraLib?: { content: string; uri: string }
  /**
   * Suggests `values` when accessing members on `<receiver>`, e.g. column
   * names for `row["..."]` and `row.<name>`. Names that are not valid JS
   * identifiers are inserted in bracket form when picked after a dot.
   */
  memberCompletions?: { receiver: string; values: string[] }
  /** Bound to Ctrl/Cmd+Enter. */
  onRunShortcut?: () => void
}

const GRAY_THEME = "codeEditorGray"
const LIGHT_THEME = "codeEditorLight"
const MIN_HEIGHT = 80 // px, matches the min-h-20 of the dialog inputs

const defineThemes: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(GRAY_THEME, {
    base: "vs",
    inherit: true,
    rules: [],
    // Tailwind gray-100
    colors: { "editor.background": "#F3F4F6" },
  })
  monaco.editor.defineTheme(LIGHT_THEME, {
    base: "vs",
    inherit: true,
    rules: [],
    colors: { "editor.background": "#FFFFFF" },
  })
}

/**
 * Minimal Monaco-based code input: syntax highlighting and autocomplete, but
 * no line numbers, search, folding or other IDE chrome. ArrowUp/ArrowDown
 * browse a localStorage-backed input history, devtools-console style: only
 * from the first/last line and while no autocomplete/parameter-hints widget
 * is open, so they never interfere with cursor movement or widget selection.
 */
function CodeEditor({
  value,
  onValueChange,
  path,
  className,
  "data-testid": dataTestId,
  placeholder,
  fillContainer = false,
  grayBackground = false,
  contentPadding = 5,
  localStorageHistoryKey,
  maxHistoryEntries = 50,
  extraLib,
  memberCompletions,
  onRunShortcut,
}: CodeEditorProps) {
  // History state lives in refs: monaco key bindings are registered once on
  // mount and must always see the latest values.
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef<number | null>(null)
  const preHistoryValueRef = useRef("")
  const valueRef = useRef(value)
  const onValueChangeRef = useRef(onValueChange)
  const onRunShortcutRef = useRef(onRunShortcut)
  const completionsRef = useRef(memberCompletions)
  const disposablesRef = useRef<Array<{ dispose(): void }>>([])
  const [height, setHeight] = useState<number>(MIN_HEIGHT)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    onValueChangeRef.current = onValueChange
    onRunShortcutRef.current = onRunShortcut
    completionsRef.current = memberCompletions
  }, [onValueChange, onRunShortcut, memberCompletions])

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
          historyRef.current = updatedHistory
        }
      } catch (error) {
        // Catch all, but just log errors, such that this never actually has user impact when failing
        console.error(error)
        historyRef.current = []
      }
    },
    [localStorageHistoryKey, maxHistoryEntries],
  )

  // Navigate the input history. Only reachable via the keybindings registered
  // in handleMount, whose when-clauses ensure this never interferes with
  // cursor movement or autocomplete selection.
  const navigateHistory = (direction: "up" | "down") => {
    const history = historyRef.current
    if (!localStorageHistoryKey || history.length === 0) return
    const historyIndex = historyIndexRef.current

    if (direction === "up") {
      if (historyIndex === null) {
        preHistoryValueRef.current = valueRef.current
        historyIndexRef.current = 0
        onValueChangeRef.current(history[0])
      } else if (historyIndex < history.length - 1) {
        historyIndexRef.current = historyIndex + 1
        onValueChangeRef.current(history[historyIndex + 1])
      }
      return
    }

    if (historyIndex === null) return
    if (historyIndex > 0) {
      historyIndexRef.current = historyIndex - 1
      onValueChangeRef.current(history[historyIndex - 1])
    } else {
      historyIndexRef.current = null
      onValueChangeRef.current(preHistoryValueRef.current)
      preHistoryValueRef.current = ""
    }
  }

  const handleMount: OnMount = (editor, monaco) => {
    // History browsing via ArrowUp/ArrowDown, gated by when-clauses: only
    // when the cursor is on the first/last line and no suggest/parameter-
    // hints widget is open. Otherwise the keybindings fall through to
    // monaco's defaults (cursor movement / widget selection).
    const atFirstLine = editor.createContextKey<boolean>(
      "codeEditorAtFirstLine",
      true,
    )
    const atLastLine = editor.createContextKey<boolean>(
      "codeEditorAtLastLine",
      true,
    )
    const updateLineContextKeys = (position: Position | null) => {
      const model = editor.getModel()
      atFirstLine.set(!position || position.lineNumber === 1)
      atLastLine.set(!position || position.lineNumber === model?.getLineCount())
    }
    updateLineContextKeys(editor.getPosition())
    editor.onDidChangeCursorPosition((e) => updateLineContextKeys(e.position))
    editor.addAction({
      id: "codeEditorHistoryPrev",
      label: "Input History: Previous Entry",
      run: () => navigateHistory("up"),
      keybindings: [monaco.KeyCode.UpArrow],
      keybindingContext:
        "!suggestWidgetVisible && !parameterHintsVisible && codeEditorAtFirstLine",
    })
    editor.addAction({
      id: "codeEditorHistoryNext",
      label: "Input History: Next Entry",
      run: () => navigateHistory("down"),
      keybindings: [monaco.KeyCode.DownArrow],
      keybindingContext:
        "!suggestWidgetVisible && !parameterHintsVisible && codeEditorAtLastLine",
    })
    // The find/replace widgets are not part of this minimal editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {})
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => {},
    )
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {})
    if (onRunShortcut) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunShortcutRef.current?.()
      })
    }

    // Save on blur (same as the previous editor) and leave the history
    // navigation state
    editor.onDidBlurEditorText(() => {
      saveToHistory(valueRef.current)
      historyIndexRef.current = null
    })

    if (extraLib) {
      // Note: in monaco 0.56 ESM the TS language service API lives on the
      // `typescript` module export, not on monaco.languages.typescript
      disposablesRef.current.push(
        monaco.typescript.javascriptDefaults.addExtraLib(
          extraLib.content,
          extraLib.uri,
        ),
      )
    }

    if (memberCompletions) {
      disposablesRef.current.push(
        monaco.languages.registerCompletionItemProvider("javascript", {
          triggerCharacters: ['"', "'", "."],
          provideCompletionItems(
            model: monacoEditor.ITextModel,
            position: Position,
          ) {
            if (model !== editor.getModel()) return { suggestions: [] }
            const completions = completionsRef.current
            if (!completions) return { suggestions: [] }
            const textBefore = model
              .getLineContent(position.lineNumber)
              .slice(0, position.column - 1)
            const receiver = completions.receiver.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&",
            )
            const partialRange = (partial: string) => ({
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column - partial.length,
              endColumn: position.column,
            })

            // String access: row["..."] / row['...']
            const bracketMatch = textBefore.match(
              new RegExp(`${receiver}\\s*\\[\\s*(["'])([^"']*)$`),
            )
            if (bracketMatch) {
              const partial = bracketMatch[2]
              const range = partialRange(partial)
              return {
                suggestions: completions.values.map((v) => ({
                  label: v,
                  kind: monaco.languages.CompletionItemKind.Value,
                  insertText: v,
                  range,
                })),
              }
            }

            // Property access: row.<name>
            const dotMatch = textBefore.match(
              new RegExp(`${receiver}\\.([A-Za-z0-9_$]*)$`),
            )
            if (dotMatch) {
              const partial = dotMatch[1]
              const range = partialRange(partial)
              return {
                suggestions: completions.values.map((v) =>
                  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(v)
                    ? {
                        label: v,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: v,
                        range,
                        filterText: v,
                      }
                    : {
                        // Not usable after a dot (e.g. contains spaces) —
                        // insert bracket form and remove the dot
                        label: v,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: `["${v.replace(/"/g, '\\"')}"]`,
                        range,
                        filterText: v,
                        additionalTextEdits: [
                          {
                            range: {
                              startLineNumber: position.lineNumber,
                              endLineNumber: position.lineNumber,
                              startColumn: position.column - partial.length - 1,
                              endColumn: position.column - partial.length,
                            },
                            text: "",
                          },
                        ],
                      },
                ),
              }
            }

            return { suggestions: [] }
          },
        }),
      )
    }

    if (!fillContainer) {
      // Auto-grow with the content (no inner scrollbar), like the previous
      // textarea-based editor
      editor.onDidContentSizeChange(() => {
        setHeight(Math.max(MIN_HEIGHT, editor.getContentHeight()))
      })
      setHeight(Math.max(MIN_HEIGHT, editor.getContentHeight()))
    }
  }

  // Load history from localStorage on startup; save the last value on unmount
  // (e.g. when the containing modal is closed)
  useEffect(() => {
    if (!localStorageHistoryKey) return
    const stored = tryParseJSONObject(
      localStorage.getItem(localStorageHistoryKey) || "[]",
    )
    historyRef.current = stored || []

    return () => {
      saveToHistory(valueRef.current)
    }
  }, [localStorageHistoryKey, saveToHistory])

  // Dispose the globally registered monaco services on unmount
  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((d) => d.dispose())
      disposablesRef.current = []
    }
  }, [])

  // onChange fires synchronously per edit, so keeping valueRef up to date
  // here (rather than only via the effect below) guarantees the history
  // handlers always see the current content, even before React re-renders
  const handleChange = (newValue: string | undefined) => {
    valueRef.current = newValue ?? ""
    onValueChange(newValue ?? "")
  }

  return (
    <div
      data-testid={dataTestId}
      className={cn("relative", className)}
      style={fillContainer ? undefined : { height }}
    >
      <MonacoEditor
        path={path}
        language="javascript"
        value={value}
        onChange={handleChange}
        theme={grayBackground ? GRAY_THEME : LIGHT_THEME}
        beforeMount={defineThemes}
        onMount={handleMount}
        width="100%"
        height="100%"
        loading={<div style={{ height: "100%" }} />}
        options={{
          minimap: { enabled: false },
          lineNumbers: "off",
          lineDecorationsWidth: 5,
          glyphMargin: false,
          folding: false,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          wrappingIndent: "none",
          contextmenu: false,
          automaticLayout: true,
          fixedOverflowWidgets: true,
          fontFamily: "monospace",
          fontSize: 14,
          padding: { top: contentPadding, bottom: contentPadding },
          tabSize: 2,
          insertSpaces: true,
          autoClosingBrackets: "never",
          autoClosingQuotes: "never",
          // Enter accepts a suggestion only when it makes a textual change;
          // otherwise it inserts a newline (Tab always accepts)
          acceptSuggestionOnEnter: "smart",
          renderValidationDecorations: "off",
          hover: { enabled: "off" },
          occurrencesHighlight: "off",
          selectionHighlight: false,
          matchBrackets: "never",
          stickyScroll: { enabled: false },
          guides: { indentation: false, bracketPairs: false },
          scrollbar: fillContainer
            ? {
                vertical: "auto",
                horizontal: "hidden",
                alwaysConsumeMouseWheel: false,
              }
            : {
                vertical: "hidden",
                horizontal: "hidden",
                handleMouseWheel: false,
              },
        }}
      />
      {placeholder !== undefined && value === "" && (
        <div
          className="pointer-events-none absolute font-mono text-sm whitespace-pre-wrap text-gray-400"
          style={{ top: contentPadding, left: 5, right: 5 }}
        >
          {placeholder}
        </div>
      )}
    </div>
  )
}

export default CodeEditor
