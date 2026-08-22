#!/usr/bin/env node
// Post-build step for `npm run build`. Scans out/ (the static Next.js export),
// generates a precache manifest, and injects it into out/sw.js by replacing
// the placeholders in public/sw.js. Run from the repo root: node scripts/gen-sw-assets.mjs

import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, relative, sep } from "node:path"

const OUT_DIR = "out"

function walk(dir) {
  const stack = [dir]
  const files = []
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile()) {
        files.push(full)
      }
    }
  }
  return files
}

const EXCLUDED_FILES = new Set(["sw.js", ".htaccess", "llms.txt"])
const PRECACHE_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".webmanifest",
  ".json",
  ".woff",
  ".woff2",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".webp",
  ".txt",
])

// Convert an on-disk path under out/ into its public URL.
// With `trailingSlash: true`, directory index files map to "/dir/" URLs.
function toUrlPath(file) {
  let rel = relative(OUT_DIR, file).split(sep).join("/")
  rel = "/" + rel
  if (rel === "/index.html") return "/"
  if (rel.endsWith("/index.html")) return rel.slice(0, -"index.html".length)
  return rel
}

const allFiles = walk(OUT_DIR)

const precacheUrls = allFiles
  .filter((file) => {
    const rel = relative(OUT_DIR, file).split(sep).join("/")
    const base = rel.split("/").pop()
    if (EXCLUDED_FILES.has(base)) return false
    const dot = base.lastIndexOf(".")
    if (dot === -1) return false
    return PRECACHE_EXTENSIONS.has(base.slice(dot).toLowerCase())
  })
  .map(toUrlPath)
  .sort()

if (!precacheUrls.includes("/")) {
  console.error("gen-sw-assets: no root HTML page found in out/, aborting")
  process.exit(1)
}

// A stable per-build fingerprint so each build produces a distinct SW cache
// and the browser picks up the new service worker via byte comparison.
const hash = createHash("sha256")
for (const file of allFiles) {
  hash.update(relative(OUT_DIR, file))
  hash.update(String(statSync(file).size))
}
const buildId = hash.digest("hex").slice(0, 16)
const cacheName = `fileglance-${buildId}`

const swPath = join(OUT_DIR, "sw.js")
let swSource = readFileSync(swPath, "utf8")
if (
  !swSource.includes("__SW_CACHE_NAME__") ||
  !swSource.includes("__SW_PRECACHE_URLS__")
) {
  console.error("gen-sw-assets: placeholders not found in out/sw.js")
  process.exit(1)
}
swSource = swSource
  .replaceAll("__SW_CACHE_NAME__", () => cacheName)
  .replaceAll("__SW_PRECACHE_URLS__", () => JSON.stringify(precacheUrls))
writeFileSync(swPath, swSource)

// Turbopack passes worker bootstrap config via a URL fragment (#params=...) for
// dedicated workers. Fragments never reach a service worker, and Chrome derives
// a worker's location from the SW response URL, so cached workers would boot
// without their config ("Missing worker bootstrap config"). Rewriting the
// runtime to use a query param instead keeps the config intact through the
// service-worker round trip (searchParams.set encodes on its own, so the
// encodeURIComponent call is dropped, not kept). NOTE: matches the minified
// Next 16.2 output; if this no longer replaces anything after a Next upgrade,
// check whether the runtime template changed.
const hashParamPattern =
  /([$\w]+)\.hash="#params="\+encodeURIComponent\(([$\w]+)\)/g
let patchCount = 0
for (const file of allFiles) {
  if (!file.endsWith(".js") || !file.includes(`${sep}_next${sep}static`)) {
    continue
  }
  const source = readFileSync(file, "utf8")
  if (!source.includes('.hash="#params="')) continue
  const patched = source.replace(hashParamPattern, (_m, obj, val) => {
    patchCount++
    return `${obj}.searchParams.set("params",${val})`
  })
  writeFileSync(file, patched)
}
if (patchCount === 0) {
  console.warn(
    "gen-sw-assets: warning: no #params= worker runtime sites were patched",
  )
}

console.log(
  `gen-sw-assets: precaching ${precacheUrls.length} assets as "${cacheName}" (${patchCount} worker runtime sites patched)`,
)
