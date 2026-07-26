import { Page, expect } from "@playwright/test"

export async function waitForClipboard(
  page: Page,
  { timeout = 2000, interval = 50 } = {},
) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const text = await page.evaluate(() => navigator.clipboard.readText())
    if (text) return text
    await page.waitForTimeout(interval)
  }
  throw new Error("Timed out waiting for clipboard to be filled")
}

/**
 * Replaces the content of a Monaco-based editor (see
 * src/components/ui/CodeEditor.tsx) inside the given testid container.
 * Drives the edit through monaco's own API (exposed as window.monaco by
 * MonacoEditorLocal.tsx), which reliably replaces the whole content and flows
 * through onChange like regular typing. Keyboard-based approaches (select-all
 * via Cmd/Ctrl+A) race with monaco's EditContext focus handling and are
 * therefore not used.
 */
export async function fillCodeEditor(page: Page, testId: string, code: string) {
  // Wait for the editor (and with it window.monaco) to appear
  const editorLocator = page.getByTestId(testId).locator(".monaco-editor")
  await editorLocator.waitFor({ state: "visible" })
  await page.evaluate(
    ([testId, text]) => {
      const monaco = (
        window as unknown as {
          monaco: typeof import("monaco-editor")
        }
      ).monaco
      const container = document.querySelector(`[data-testid="${testId}"]`)
      const editor = monaco.editor
        .getEditors()
        .find((e) => container?.contains(e.getDomNode()))
      if (!editor) throw new Error(`No monaco editor found for ${testId}`)
      const model = editor.getModel()
      if (!model) throw new Error(`No monaco model found for ${testId}`)
      editor.executeEdits("test", [{ range: model.getFullModelRange(), text }])
      editor.focus()
    },
    [testId, code] as const,
  )
  // Ensure the editor actually holds focus before returning — under load,
  // focus() can take a moment, and subsequent key presses (e.g. ArrowUp for
  // history navigation) would otherwise go to the page instead of the editor
  await expect
    .poll(async () =>
      page.evaluate(
        (testId) =>
          document
            .querySelector(`[data-testid="${testId}"]`)
            ?.contains(document.activeElement) ?? false,
        testId,
      ),
    )
    .toBe(true)
}
