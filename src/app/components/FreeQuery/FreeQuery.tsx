"use client"
import React from "react"
import { Button } from "@/components/ui/button"
import { postProcessCode, saveFile } from "@/utils"
import { Download } from "lucide-react"
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline"
import { PlayIcon } from "@heroicons/react/20/solid"
import { highlight, languages } from "prismjs"
import Split from "react-split"
import "prismjs/components/prism-clike"
import "prismjs/components/prism-javascript"
import "prismjs/components/prism-json"
import "prismjs/themes/prism.css"
import "./FreeQuery.css"
import { toast } from "@/hooks/use-toast"
import MonacoEditor, { loader } from "@monaco-editor/react"
import Editor from "@/components/ui/Editor"

interface FreeQueryProps {
  data: any[][]
  headerRow: string[]
}

export function FreeQuery({ data, headerRow }: FreeQueryProps) {
  const [query, setQuery] = React.useState<string>("")
  const [output, setOutput] = React.useState<string>("")
  const [outputType, setOutputType] = React.useState<string>("")

  //   TODO: How to use monaco with local/npm files only in the future?
  //   React.useEffect(() => {
  //     let monaco: typeof import("monaco-editor") | undefined
  //     if (typeof window !== "undefined") {
  //       import("monaco-editor").then((monacoModule) => {
  //         monaco = monacoModule
  //         loader.config({ monaco })
  //         loader.init()
  //       })
  //     }
  //   }, [])

  React.useEffect(() => {
    loader.init()
  }, [])

  const handleRun = () => {
    try {
      const code = postProcessCode(query)
      // Create a function from the query string
      const queryFn = new Function("data", "headers", code)
      const result = queryFn(data, headerRow)
      const resultType = typeof result

      setOutput(
        resultType === "string" ? result : JSON.stringify(result, null, 2),
      )
      setOutputType(resultType)
    } catch (error: any) {
      setOutput(`Error: ${error.message || String(error)}`)
      setOutputType("error")
    }
  }

  const noActualOutput = !output || outputType === "error"
  return (
    <div className="w-full h-full px-1 rounded-xl border border-gray-200 shadow-sm">
      {/* Top action bar */}
      <div className="flex flex-row items-center justify-end">
        <Button
          variant="ghost"
          size="icon"
          title="Copy to clipboard"
          disabled={noActualOutput}
          onClick={() => {
            if (!output) return
            navigator.clipboard.writeText(output)
            toast({
              title: "Output copied to clipboard",
              variant: "success",
            })
          }}
        >
          <ClipboardDocumentCheckIcon className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Download output"
          disabled={noActualOutput}
          onClick={() => {
            if (!output) return
            let blob, filename
            if (outputType === "object") {
              blob = new Blob([output], { type: "application/json" })
              filename = "output.json"
            } else {
              blob = new Blob([output], { type: "text/plain" })
              filename = "output.txt"
            }
            saveFile(blob, filename)
            toast({
              title: "File downloaded",
              variant: "success",
            })
          }}
        >
          <Download className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          onClick={handleRun}
          disabled={!query}
          size="sm"
          title="Run Query (Ctrl/Cmd + Enter)"
        >
          <PlayIcon className="w-5 h-5 mr-1" />
          Run Query
        </Button>
      </div>
      {/* Split panels */}
      <Split
        className="flex gap-1 h-full"
        sizes={[33, 77]}
        gutterSize={2}
        minSize={240}
      >
        <div className="flex flex-col min-w-0 px-1">
          <span className="text-sm font-medium">Query Code</span>
          <div className="flex-1 relative overflow-hidden">
            <Editor
              data-testid={`queryCodeHints`}
              className="w-full font-mono text-sm"
              value={"(data: any[][], headers: string[]) =>"}
              highlight={(code) => highlight(code, languages.js, "js")}
              padding={5}
              disabled={true}
              onValueChange={() => {}}
            />
            <Editor
              value={query}
              onValueChange={(code) => setQuery(code)}
              highlight={(code) =>
                highlight(code, languages.javascript, "javascript")
              }
              padding={16}
              className="font-mono min-h-1/4 text-sm border border-gray-200 rounded-md"
              placeholder={`// Example:\nreturn data.filter(row => row["${headerRow[0]}"] === ${JSON.stringify(data[0][0])})`}
              style={{ overflow: "auto" }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.metaKey && e.key === "Enter") {
                  e.preventDefault()
                  handleRun()
                }
              }}
              localStorageHistoryKey="freeQueryCodeHistory"
            />
          </div>
        </div>
        <div className="flex flex-col min-w-0 h-full px-1">
          <span className="text-sm font-medium">Output</span>
          {output ? (
            outputType === "error" ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-red-500 pb-8 text-center font-mono">
                  {output}
                </span>
              </div>
            ) : (
              <MonacoEditor
                width="100%"
                className="flex-1 font-mono text-sm"
                language={outputType === "object" ? "json" : "text"}
                value={output}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  lineNumbers: "off",
                  fontFamily: "monospace",
                  renderLineHighlight: "none",
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  glyphMargin: false,
                  renderValidationDecorations: "off",
                  contextmenu: false,
                  padding: { top: 8, bottom: 8 },
                }}
              />
            )
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-gray-400 pb-8 text-center select-none">
                Enter a query code and hit <b>Run Query</b> to see output here.
              </span>
            </div>
          )}
        </div>
      </Split>
    </div>
  )
}
