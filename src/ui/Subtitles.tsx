import { useEffect, useRef, useState } from 'react'
import { useCharacterStore } from '../store/characterStore'
import { useSettings } from '../store/settingsStore'
import { director } from '../character/director'

/** Karaoke-style subtitles synced with the lip-sync clock (spec §58). */
export default function Subtitles() {
  const speaking = useCharacterStore((s) => s.speaking)
  const last = useCharacterStore((s) => [...s.messages].reverse().find((m) => m.role === 'assistant')?.content ?? '')
  const enabled = useSettings((s) => s.subtitles)
  const size = useSettings((s) => s.textSize)
  const [shown, setShown] = useState('')
  const raf = useRef(0)
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    if (!speaking || !last) { setShown(''); return }
    const tick = () => {
      const p = director.lip.playing || director.externalTiming ? Math.min(1, director.lip.progress * 1.08 + 0.02) : 1
      const words = last.split(/(\s+)/)
      let n = Math.ceil(last.length * p), out = ''
      for (const w of words) { if (n <= 0) break; out += w; n -= w.length }
      setShown(out)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [speaking, last])
  if (!enabled || !shown) return null
  return <div className={`subtitles ${size}`} role="status" aria-live="off">{shown}</div>
}
