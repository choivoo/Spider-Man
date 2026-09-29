import { useRef, useState } from 'react'
import { useCharacterStore } from '../store/characterStore'
import { command } from '../transformation'
import { cycleCamera } from './useHotkeys'
import { toggleMic } from './voiceControl'
import { triggerSpiderSense } from '../character/SpiderFX'
import { SpeechInput } from '../audio/VoiceManager'

const HOLD_MS = 520

/**
 * Floating control wheel (spec §32). Long-press the Spider button = suit toggle.
 * Tap = open radial sub-buttons: Mask · Arms · Camera · Voice (+ Sense).
 */
export default function MobileWheel() {
  const suit = useCharacterStore((s) => s.suit)
  const listening = useCharacterStore((s) => s.voice.listening)
  const [open, setOpen] = useState(false)
  const [hold, setHold] = useState(0)
  const timer = useRef<number>(0)
  const start = useRef(0)
  const fired = useRef(false)
  const busy = suit.phase !== 'IDLE'
  const spider = suit.form === 'SPIDER'

  const buzz = (ms = 18) => { try { navigator.vibrate?.(ms) } catch { /* not supported */ } }
  const tick = () => {
    const p = Math.min(1, (performance.now() - start.current) / HOLD_MS)
    setHold(p)
    if (p >= 1) { fired.current = true; setHold(0); buzz(30); command('SUIT_TOGGLE'); setOpen(false); return }
    timer.current = requestAnimationFrame(tick)
  }
  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId)
    fired.current = false; start.current = performance.now(); timer.current = requestAnimationFrame(tick)
  }
  const up = () => {
    cancelAnimationFrame(timer.current); setHold(0)
    if (!fired.current) { buzz(8); setOpen((o) => !o) }
  }
  const cancel = () => { cancelAnimationFrame(timer.current); setHold(0) }

  const items: { id: string; label: string; icon: string; on: () => void; disabled?: boolean; active?: boolean }[] = [
    { id: 'mask', label: 'Mask', icon: '◐', on: () => command('MASK_TOGGLE'), disabled: !spider || busy },
    { id: 'arms', label: 'Spider arms', icon: '✳', on: () => command('ARMS_TOGGLE'), disabled: !spider || busy },
    { id: 'cam', label: 'Camera', icon: '◎', on: cycleCamera },
    { id: 'voice', label: 'Voice', icon: '🎙', on: toggleMic, disabled: !SpeechInput.supported(), active: listening },
    { id: 'sense', label: 'Spider sense', icon: '⚡', on: triggerSpiderSense },
  ]
  const R = 92
  return (
    <div className={`wheel${open ? ' open' : ''}${spider ? ' spider' : ''}`}>
      {items.map((it, i) => {
        const a = (Math.PI * (176 + (i * 94) / (items.length - 1))) / 180 // quarter fan: left → up from the button
        const x = Math.cos(a) * R, y = Math.sin(a) * R
        return (
          <button key={it.id} className={`wheel-item${it.active ? ' on' : ''}`} style={{ transform: open ? `translate(${x}px, ${y}px)` : 'translate(0,0) scale(.3)', transitionDelay: `${open ? i * 30 : 0}ms` }}
            disabled={it.disabled || !open} aria-label={it.label} onClick={() => { buzz(8); it.on(); if (it.id !== 'voice') setOpen(false) }}>{it.icon}</button>
        )
      })}
      <button className="wheel-main" aria-label="Spider controls — hold to suit up or down" aria-expanded={open}
        onPointerDown={down} onPointerUp={up} onPointerCancel={cancel} onPointerLeave={cancel} disabled={busy}>
        <svg viewBox="0 0 44 44" className="wheel-ring" aria-hidden="true"><circle cx="22" cy="22" r="20" fill="none" strokeWidth="3" strokeDasharray={`${hold * 125.6} 125.6`} transform="rotate(-90 22 22)" /></svg>
        <span aria-hidden="true">🕷</span>
      </button>
    </div>
  )
}
