/* SPIDER-AI service worker — offline app shell.
 * - navigations: network-first, falling back to the cached shell (so the app opens offline)
 * - /assets/* (hashed) and static files: cache-first
 * - /api/*: never cached (chat/memory/tts always go to the network; the UI shows "Connection temporarily unavailable")
 */
const VERSION = 'v1'
const SHELL = `spider-ai-shell-${VERSION}`
const RUNTIME = `spider-ai-runtime-${VERSION}`
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, RUNTIME].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting() })

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put('/', copy)); return res })
        .catch(() => caches.match('/').then((r) => r || new Response('Offline', { status: 503 }))),
    )
    return
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/models/') || url.pathname.startsWith('/basis/'))) {
        const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy))
      }
      return res
    })),
  )
})
