// FileGlance service worker.
// The cache name and precache URL list are injected by scripts/gen-sw-assets.mjs
// as part of `npm run build`. Do not rename those constants.

const CACHE_NAME = "__SW_CACHE_NAME__"
const PRECACHE_URLS = __SW_PRECACHE_URLS__

// Cross-origin hosts whose requests must never be intercepted or cached
// (privacy analytics should simply fail silently when offline).
const BYPASSED_HOSTNAMES = ["piwik.mdell.org"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // Precache one URL at a time so a single failing/missing asset does not
      // abort the entire install. Avoid spread calls: the asset list is
      // unbounded and can exceed the engine's argument limit.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))),
      )
      await self.clients.claim()
    })(),
  )
})

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    throw error
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached =
    (await cache.match(request)) ||
    // Next.js RSC prefetch payloads live on disk without their _rsc query
    // param, so fall back to matching by path alone.
    (await cache.match(request, { ignoreSearch: true }))
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => null)
  return cached || (await network) || Response.error()
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = (await cache.match(request)) || (await cache.match("/"))
    if (cached) return cached
    throw error
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event

  if (request.method !== "GET") return

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return
  if (BYPASSED_HOSTNAMES.includes(url.hostname)) return
  if (url.pathname === "/sw.js") return

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|gif|svg|ico|webp|webmanifest)$/i.test(
      url.pathname,
    )
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})
