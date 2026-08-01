import { test, expect } from "@playwright/test"
import path from "path"

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/")
})

// Regression: once a file is loaded (state "finished") the whole-window drop
// target must refuse drag-dropped data/transformer files so an accidental drop
// cannot replace the working session. Only a .fg.json transformer is still
// accepted in "finished" state (covered by Transform.spec.ts). This spec
// verifies the refusal for an ordinary data file.
test("drag-drop of a data file is ignored while a file is already loaded", async ({
  page,
}) => {
  // 1. Load sample.csv via the file picker ("initial" -> "finished").
  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(
    path.join(import.meta.dirname, "../files", "sample.csv"),
  )
  // The filename span (title attribute) only renders in "finished" state.
  const loadedName = page.locator('span[title="sample.csv"]')
  await expect(loadedName).toBeVisible()

  // 2. Synthesize a drop carrying a different data file.
  // Playwright cannot drive a real OS drag-drop, and a synthetic DataTransfer's
  // webkitGetAsEntry() returns null so handleDrop's entries branch yields no
  // files. We therefore stub dataTransfer with items:[] / files:[File], which
  // makes handleDrop take the synchronous files-fallback branch with a real
  // File object. The dropped file's content is irrelevant here because we
  // assert the guard rejects it before parseFiles runs, so an empty File with
  // just the target name is enough.
  // Dispatch on [data-testid="DataTable"] (mounted only in "finished" state,
  // a descendant of the root drop <div> whose listeners are bound manually).
  await page.evaluate((name) => {
    const file = new File([], name)
    const fakeDataTransfer = { items: [], files: [file] }
    const ev = new DragEvent("drop", { bubbles: true, cancelable: true })
    Object.defineProperty(ev, "dataTransfer", { value: fakeDataTransfer })
    const target = document.querySelector('[data-testid="DataTable"]')
    if (!target) throw new Error("DataTable not found — not in finished state")
    target.dispatchEvent(ev)
  }, "small_sample.tsv")

  // 3. A toast announcing the ignored drop appears (Radix Toast Root has
  //    role="status" by default, populated by ToastTitle in toaster.tsx).
  await expect(
    page.getByRole("status").filter({ hasText: /ignored/i }),
  ).toBeVisible()

  // 4. The originally loaded file is still displayed: parseFiles was NOT
  //    invoked, so sample.csv was not swapped for small_sample.tsv.
  await expect(page.locator('span[title="small_sample.tsv"]')).toHaveCount(0)
  await expect(loadedName).toBeVisible()
})

// Regression for the mirror case: a .fg.json transformer must also be refused
// on the landing screen ("initial" state), since importTransformer only sets
// view-state and never advances parsingState — applying it with no data loaded
// would dead-end on the landing page. We exercise the file-picker path here
// (the picker is only mounted in "initial"), which also covers the pre-existing
// bug where the picker did not special-case .fg.json and mis-parsed it as
// ordinary JSON ("No array in JSON found").
test("picking a .fg.json transformer via the file picker is refused with no data loaded", async ({
  page,
}) => {
  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByTestId("fileInput").click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: "Transformer.fg.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ transformers: [], filters: [] })),
  })

  // The transformer is refused: a toast announces it was ignored.
  await expect(
    page.getByRole("status").filter({ hasText: /ignored/i }),
  ).toBeVisible()

  // The app stays on the landing screen (FileChooser still present), and never
  // advanced into "parsing"/"finished". The FileChooser dropzone is only
  // rendered in "initial" state.
  await expect(page.getByTestId("fileInput")).toBeVisible()
})
