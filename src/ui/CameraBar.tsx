import { useCharacterStore, type CameraMode } from '../store/characterStore'
import { usePwa } from '../pwa'

const MODES: { id: CameraMode; label: string }[] = [
  { id: 'face', label: 'Face' }, { id: 'upper', label: 'Upper' }, { id: 'full', label: 'Full' }, { id: 'cinematic', label: 'Cine' },
]

export default function CameraBar({ onSettings }: { onSettings: () => void }) {
  const mode = useCharacterStore((s) => s.cameraMode)
  const set = useCharacterStore((s) => s.setCameraMode)
  const pwa = usePwa()
  return (
    <div className="camera-bar" role="toolbar" aria-label="Camera mode">
      {MODES.map((m) => (
        <button key={m.id} className={mode === m.id ? 'on' : ''} aria-pressed={mode === m.id} onClick={() => set(m.id)}>{m.label}</button>
      ))}
      <button className="icon" onClick={onSettings} aria-label="Settings" title="Settings">⚙</button>
      {pwa.canInstall && <button className="icon" onClick={() => void pwa.install()} aria-label="Install app" title="Install app">⤓</button>}
    </div>
  )
}
