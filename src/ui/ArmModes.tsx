import { useCharacterStore } from '../store/characterStore'
import { nano, publishSuitStatus } from '../transformation'

/** Spider-arm pose modes (visible while the arms are deployed). */
export default function ArmModes() {
  const suit = useCharacterStore((s) => s.suit)
  if (suit.arms !== 'ARMS_DEPLOYED') return null
  return (
    <div className="controls modes" role="toolbar" aria-label="Spider arm modes">
      {(['IDLE', 'DEFENSE', 'ATTACK', 'BALANCE', 'POSE'] as const).map((m) => (
        <button key={m} className={suit.armsMode === m ? 'on' : ''} aria-pressed={suit.armsMode === m} onClick={() => { nano.setArmsMode(m); publishSuitStatus(true) }}>{m[0] + m.slice(1).toLowerCase()}</button>
      ))}
    </div>
  )
}
