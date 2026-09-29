import { useCharacterStore } from '../store/characterStore'
import { command, nano, publishSuitStatus } from '../transformation'
import { cycleCamera } from './useHotkeys'
import { useSettings } from '../store/settingsStore'
import { triggerSpiderSense, triggerWebShoot } from '../character/SpiderFX'

/** Desktop control strip. (The mobile floating wheel lives in MobileWheel.tsx.) */
export default function Controls() {
  const suit = useCharacterStore((s) => s.suit)
  const hud = useSettings((s) => s.hud)
  const set = useSettings((s) => s.set)
  const busy = suit.phase !== 'IDLE'
  const deployed = suit.arms === 'ARMS_DEPLOYED'
  const spider = suit.form === 'SPIDER'
  return (
    <div className="controls-wrap">
      {deployed && (
        <div className="controls modes" role="toolbar" aria-label="Spider arm modes">
          {(['IDLE', 'DEFENSE', 'ATTACK', 'BALANCE', 'POSE'] as const).map((m) => (
            <button key={m} className={suit.armsMode === m ? 'on' : ''} aria-pressed={suit.armsMode === m} onClick={() => { nano.setArmsMode(m); publishSuitStatus(true) }}>{m[0] + m.slice(1).toLowerCase()}</button>
          ))}
        </div>
      )}
    <div className="controls" role="toolbar" aria-label="Suit controls">
      <button onClick={() => command('SUIT_TOGGLE')} disabled={busy} aria-keyshortcuts="Shift+S" title="Suit up / down (Shift+S)">{spider ? 'Suit ↓' : 'Suit ↑'}<kbd>⇧S</kbd></button>
      <button onClick={() => command('MASK_TOGGLE')} disabled={!spider || busy} aria-keyshortcuts="M" title="Mask (M)">Mask<kbd>M</kbd></button>
      <button onClick={() => command('ARMS_TOGGLE')} disabled={!spider || busy} aria-keyshortcuts="A" title="Spider arms (A)">Arms<kbd>A</kbd></button>
      <button onClick={triggerSpiderSense} title="Spider sense (X)">Sense<kbd>X</kbd></button>
      <button onClick={triggerWebShoot} disabled={!spider} title="Web shooter (B)">Web<kbd>B</kbd></button>
      <button onClick={cycleCamera} aria-keyshortcuts="C" title="Camera (C)">Cam<kbd>C</kbd></button>
      <button onClick={() => set({ hud: !hud })} aria-pressed={hud} aria-keyshortcuts="H" title="HUD (H)">HUD<kbd>H</kbd></button>
    </div>
    </div>
  )
}
