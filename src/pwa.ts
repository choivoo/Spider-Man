import { create } from 'zustand'

interface BIPEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

interface PwaStore {
  canInstall: boolean
  installed: boolean
  ios: boolean
  updateReady: boolean
  install: () => Promise<void>
  applyUpdate: () => void
}

let deferred: BIPEvent | null = null
let waiting: ServiceWorker | null = null

const isStandalone = () =>
  (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const usePwa = create<PwaStore>((set) => ({
  canInstall: false,
  installed: typeof window !== 'undefined' && isStandalone(),
  ios: typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone(),
  updateReady: false,
  install: async () => {
    if (!deferred) return
    await deferred.prompt()
    const r = await deferred.userChoice
    deferred = null
    set({ canInstall: false, installed: r.outcome === 'accepted' })
  },
  applyUpdate: () => { waiting?.postMessage('SKIP_WAITING') },
}))

export function initPwa() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; usePwa.setState({ canInstall: true }) })
  window.addEventListener('appinstalled', () => usePwa.setState({ installed: true, canInstall: false }))
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          nw?.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) { waiting = nw; usePwa.setState({ updateReady: true }) }
          })
        })
      }).catch(() => { /* offline shell is a progressive enhancement */ })
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload() } })
    })
  }
}
