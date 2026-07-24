"use client"
import dynamic from "next/dynamic"
import type { EditorProps } from "@monaco-editor/react"

// Monaco is bundled locally (no CDN) and loaded lazily, since it is not
// SSR-safe. Consumers can simply render this component.
const MonacoEditorLocal = dynamic(() => import("./MonacoEditorLocal"), {
  ssr: false,
})

export default function MonacoEditor(props: EditorProps) {
  return <MonacoEditorLocal {...props} />
}
