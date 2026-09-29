import { useEffect, useState } from 'react'
import { useBoot, BOOT_STEPS } from '../boot'

const MIN_MS = 1100
const MAX_MS = 9000

export default function LoadingScreen() {
  const done = useBoot((s) => s.done)
  const ready = useBoot((s) => s.ready)
  const finish = useBoot((s) => s.finish)
  const [gone, setGone] = useState(false)
  const [t0] = useState(() => performance.now())
  const count = BOOT_STEPS.filter((s) => done[s.id]).length
  const all = count === BOOT_STEPS.length

  useEffect(() => {
    if (!all) return
    const wait = Math.max(0, MIN_MS - (performance.now() - t0))
    const id = setTimeout(finish, wait)
    return () => clearTimeout(id)
  }, [all, finish, t0])
  useEffect(() => { const id = setTimeout(finish, MAX_MS); return () => clearTimeout(id) }, [finish]) // never trap the user
  useEffect(() => { if (ready) { const id = setTimeout(() => setGone(true), 700); return () => clearTimeout(id) } }, [ready])
  if (gone) return null

  const current = BOOT_STEPS.find((s) => !done[s.id])
  return (
    <div className={`loading${ready ? ' out' : ''}`} role="status" aria-live="polite" aria-busy={!ready}>
      <svg className="loading-web" viewBox="0 0 200 200" aria-hidden="true">
        <g fill="none" stroke="#e94b52" strokeWidth=".5" opacity=".5">{[1, 2, 3, 4, 5].map((i) => <circle key={i} cx="100" cy="100" r={i * 18} />)}{Array.from({ length: 12 }, (_, i) => <line key={i} x1="100" y1="100" x2={100 + Math.cos((i * Math.PI) / 6) * 95} y2={100 + Math.sin((i * Math.PI) / 6) * 95} />)}</g>
      </svg>
      <h1>SPIDER<span>-</span>AI</h1>
      <div className="loading-bar"><i style={{ width: `${(ready ? 4 : count) * 25}%` }} /></div>
      <p className="loading-step">{ready ? 'Ready' : current?.label ?? 'Almost there…'}</p>
      <ul className="loading-list" aria-hidden="true">
        {BOOT_STEPS.map((s) => <li key={s.id} className={done[s.id] ? 'ok' : ''}>{s.label}</li>)}
        <li className={ready ? 'ok' : ''}>Ready</li>
      </ul>
    </div>
  )
}
