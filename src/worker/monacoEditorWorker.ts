// Worker entry bundling monaco's base editor worker locally.
// Referenced via `new Worker(new URL(...))` in components/ui/MonacoEditorLocal.tsx.
import "monaco-editor/editor/editor.worker"
