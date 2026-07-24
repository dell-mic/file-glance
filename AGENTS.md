# AGENTS.md

Compact guide for AI agents working in this repo. Verify against `package.json` and config before trusting anything below.

## Project shape

- Single-page Next.js 16 / React 19 app for viewing, filtering, and transforming tabular files (CSV, JSON, XLSX, Parquet, ZIP, …). All processing is client-side; there is no server runtime.
- `next.config.mjs` sets `output: "export"` with `trailingSlash: true`. The build emits a static site to `out/`. Do not add server-side API routes, server actions, or middleware — they will not run in the exported site.
- Real app entrypoint: `src/app/page.tsx` → `src/app/home-page.tsx`. Heavy work runs in Web Workers under `src/worker/` (`displayedDataWorker.ts`, `transformerValidationWorker.ts`).
- Path alias `@/*` → `./src/*` (see `tsconfig.json`). shadcn/ui primitives live in `src/components/ui` (config in `components.json`).
- For a Monaco code editor, use `src/components/ui/MonacoEditor.tsx` (locally bundled, no CDN; lazily loaded, SSR-safe). Never import `monaco-editor` or `@monaco-editor/react` directly elsewhere — worker setup lives in `MonacoEditorLocal.tsx` + `src/worker/monaco*Worker.ts`. Language workers are bundled for `json` and `typescript`/`javascript`; other languages fall back to the base editor worker (no language smarts) unless a worker is added in `getWorker`.
- `xlsx` is installed from the SheetJS CDN tarball (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), not npm. Keep it that way when bumping.
- Tailwind v4 via `@tailwindcss/postcss` (not the v3 CLI chain) plus `tailwindcss-animate`. `tailwind.config.ts` still exists for content globs / theme extras.

## Commands

- `npm run dev` — starts `next dev` on `:3000`, but first runs a `curl --retry` poll against `localhost:3000` in the background. That curl is intentional (used to open the browser once ready); don't "fix" it.
- `npm run check` — canonical pre-commit gate. Runs in this order, do not reorder:
  1. `format` (Prettier write)
  2. `typeCheck` (`tsc --noEmit`)
  3. `lint` (`eslint src` — note the scoped path, not the whole repo)
  4. `test:unit` (`bun test test/unit`)
  5. `test:e2e:quick` (Playwright, chromium project only)
- Run a single unit test: `bun test test/unit/<file>.test.ts` (or `bun test test/unit --filter "<name>"`). Unit tests use Bun's test runner, not node:test/jest/vitest.
- Run a single e2e test: `npx playwright test test/e2e/<name>.spec.ts` (produces snapshots under `<spec>.spec.ts-snapshots/`). Update snapshots with `npm run test:e2e:updateSnapshots` or `--update-snapshots`.
- Full e2e (all browsers): `npm run test:e2e` installs Playwright browsers then runs chromium, firefox, webkit. The Playwright `webServer` runs `npm run buildAndStart` (a production build + `serve out`) — it does NOT use the dev server, so e2e validates the static export, not `next dev`. `reuseExistingServer` is on outside CI, so a leftover server on `:3000` will be reused.
- Snapshot tolerance is loose: `maxDiffPixels: 100` for both `toHaveScreenshot` and `toMatchSnapshot` (see `playwright.config.ts`). Prefer small visual diffs over regenerating snapshots frivolously.

## Style & lint conventions

- Prettier: `semi: false` — **no semicolons**. Match existing code.
- ESLint (flat config, `eslint.config.mjs`): `@typescript-eslint/no-explicit-any`, `ban-ts-comment`, `no-unsafe-function-thing`, `no-empty-object-type` are **off**. `no-unused-vars` is `warn` with `argsIgnorePattern: "^(e|v|i|_)$"`, so single-letter args like `e`, `v`, `i`, `_` are intentional and should not be "cleaned up".
- Lint scans only `src/`; don't add `out/`, `.next/`, or files outside `src/` to the lint scope.

## Deploy & release

- No CI. Releases are manual: `./buildAndDeploy.sh` runs `npm run build` then `./deploy.sh`, which uses `lftp` over FTP (host/user/pass read from `.env`) to mirror `out/` to the remote root. `.env` is gitignored and contains `FTPHOST` / `FTPUSER` / `FTPPASS`; don't commit it.
- `next-env.d.ts`, `tsconfig.tsbuildinfo`, `out/`, `.next/`, `playwright-report/`, `test-results/` are gitignored build/test artifacts — don't commit them.

## Gotchas

- `window.d.ts` augments `Window._paq` (Matomo analytics). If you reference `_paq`, keep that ambient declaration in sync.
- `dev:https` uses `next dev --experimental-https` for testing PWA / service-worker / clipboard features that require HTTPS.
- The site is a PWA; deep-linking data via `#d=` (CSV/JSON, optionally Base64) and `#c=` (Base64 gzip) is part of the public API documented in `README.md` — preserve that behavior when touching routing or the hash parser.
