import { useCharacterStore, type CameraMode } from '../store/characterStore'

const MODES: { id: CameraMode; label: string }[] = [
  { id: 'face', label: 'Face' }, { id: 'upper', label: 'Upper' }, { id: 'full', label: 'Full' }, { id: 'cinematic', label: 'Cine' },
]

export default function CameraBar() {
  const mode = useCharacterStore((s) => s.cameraMode)
  const set = useCharacterStore((s) => s.setCameraMode)
  return (
    <div className="camera-bar" role="toolbar" aria-label="Camera mode">
      {MODES.map((m) => (
        <button key={m.id} className={mode === m.id ? 'on' : ''} aria-pressed={mode === m.id} onClick={() => set(m.id)}>{m.label}</button>
      ))}
    </div>
  )
}
