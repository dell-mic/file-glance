"use client"
import * as monaco from "monaco-editor"
import Editor, { loader, type EditorProps } from "@monaco-editor/react"

// Use the locally bundled monaco instance instead of loading it from the CDN.
loader.config({ monaco })

// Serve monaco's workers from local bundles as well. The wrapper entries are
// needed because Turbopack only compiles `new Worker(new URL(...))` entries
// from project files, not from node_modules.
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new Worker(
        new URL("../../worker/monacoJsonWorker.ts", import.meta.url),
      )
    }
    // TypeScript and JavaScript share monaco's ts worker.
    if (label === "typescript" || label === "javascript") {
      return new Worker(
        new URL("../../worker/monacoTsWorker.ts", import.meta.url),
      )
    }
    // Any other language falls back to the base editor worker, which provides
    // no language smarts. If css/html/... support is ever needed, add a worker
    // entry under src/worker and route its label here.
    return new Worker(
      new URL("../../worker/monacoEditorWorker.ts", import.meta.url),
    )
  },
}

export default function LocalMonacoEditor(props: EditorProps) {
  return <Editor {...props} />
}
