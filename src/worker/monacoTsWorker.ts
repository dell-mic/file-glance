// Worker entry bundling monaco's TypeScript/JavaScript language worker locally.
// Referenced via `new Worker(new URL(...))` in components/ui/MonacoEditorLocal.tsx.
import "monaco-editor/language/typescript/ts.worker"
