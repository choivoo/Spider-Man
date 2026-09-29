import { useCharacterStore } from '../store/characterStore'
import { useSettings } from '../store/settingsStore'

const NICE: Record<string, string> = {
  MASK_OPEN: 'OPEN', MASK_CLOSING: 'CLOSING', MASK_CLOSED: 'CLOSED', MASK_OPENING: 'OPENING',
  ARMS_RETRACTED: 'STOWED', ARMS_DEPLOYING: 'DEPLOYING', ARMS_DEPLOYED: 'ONLINE', ARMS_RETRACTING: 'STOWING',
}

/** Spider HUD (spec §30): subtle, corner-anchored, never covers the character. */
export default function HUD() {
  const suit = useCharacterStore((s) => s.suit)
  const hud = useSettings((s) => s.hud)
  const show = hud && (suit.form === 'SPIDER' || suit.phase !== 'IDLE')
  const pct = Math.round(suit.blend * 100)
  const transforming = suit.phase !== 'IDLE'
  return (
    <div className={`hud ${show ? 'on' : ''}`} aria-hidden={!show} aria-live="polite">
      <svg className="hud-web" viewBox="0 0 120 120" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.6">
          {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1="0" y1="0" x2={120 * Math.cos((i * Math.PI) / 10 + 0.05)} y2={120 * Math.sin((i * Math.PI) / 10 + 0.05)} />)}
          {[20, 38, 58, 80, 104].map((r) => <path key={r} d={`M ${r} 0 Q ${r * 0.85} ${r * 0.85} 0 ${r}`} />)}
        </g>
      </svg>
      <div className="hud-panel">
        <div className="hud-title">{transforming ? (suit.phase === 'SUIT_UP' ? 'NANO-SUIT · FORMING' : 'NANO-SUIT · RECALL') : 'NANO-SUIT · ONLINE'}</div>
        <div className="hud-bar"><i style={{ width: `${pct}%` }} /></div>
        <dl>
          <dt>SUIT</dt><dd>{pct >= 100 ? 'ACTIVE' : pct <= 0 ? 'OFF' : `${pct}%`}</dd>
          <dt>MASK</dt><dd>{NICE[suit.mask] ?? suit.mask}</dd>
          <dt>ARMS</dt><dd>{NICE[suit.arms] ?? suit.arms}{suit.armsMode !== 'IDLE' && suit.arms === 'ARMS_DEPLOYED' ? ` · ${suit.armsMode}` : ''}</dd>
        </dl>
      </div>
    </div>
  )
}
