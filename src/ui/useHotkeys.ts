import { useEffect } from 'react'
import { useCharacterStore, type CameraMode } from '../store/characterStore'
import { command } from '../transformation'
import { useSettings } from '../store/settingsStore'
import { triggerSpiderSense, triggerWebShoot } from '../character/SpiderFX'
import { nano } from '../transformation'
import { toggleMic, cancelVoice } from './voiceControl'

const CAMERA_ORDER: CameraMode[] = ['full', 'upper', 'face', 'cinematic']

export function cycleCamera() {
  const s = useCharacterStore.getState()
  const i = CAMERA_ORDER.indexOf(s.cameraMode)
  s.setCameraMode(CAMERA_ORDER[(i + 1) % CAMERA_ORDER.length])
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

/** Desktop hotkeys. Suit/mask/arms bindings are registered by later versions through `registerHotkey`. */
const extra = new Map<string, (e: KeyboardEvent) => void>()
export const registerHotkey = (combo: string, fn: (e: KeyboardEvent) => void) => { extra.set(combo, fn); return () => extra.delete(combo) }

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { (document.activeElement as HTMLElement | null)?.blur?.(); extra.get('escape')?.(e); cancelVoice(); return }
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const combo = (e.shiftKey ? 'shift+' : '') + e.key.toLowerCase()
      const fn = extra.get(combo)
      if (fn) { e.preventDefault(); fn(e); return }
      if (combo === 'c') cycleCamera()
      else if (combo === 'shift+s') command('SUIT_TOGGLE')
      else if (combo === 'm') command('MASK_TOGGLE')
      else if (combo === 'a') command('ARMS_TOGGLE')
      else if (combo === 'v') toggleMic()
      else if (combo === 'x') triggerSpiderSense()
      else if (combo === 'b') { if (nano.form === 'SPIDER') triggerWebShoot() }
      else if (combo === 'h') useSettings.getState().set({ hud: !useSettings.getState().hud })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
