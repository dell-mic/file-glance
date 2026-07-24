// Worker entry bundling monaco's JSON language worker locally.
// Referenced via `new Worker(new URL(...))` in components/ui/MonacoEditorLocal.tsx.
import "monaco-editor/language/json/json.worker"
