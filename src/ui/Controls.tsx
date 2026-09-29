import { useCharacterStore } from '../store/characterStore'
import { command } from '../transformation'
import { cycleCamera } from './useHotkeys'
import { useSettings } from '../store/settingsStore'

/** Desktop control strip. (The mobile floating wheel lives in MobileWheel.tsx.) */
export default function Controls() {
  const suit = useCharacterStore((s) => s.suit)
  const hud = useSettings((s) => s.hud)
  const set = useSettings((s) => s.set)
  const busy = suit.phase !== 'IDLE'
  const spider = suit.form === 'SPIDER'
  return (
    <div className="controls" role="toolbar" aria-label="Suit controls">
      <button onClick={() => command('SUIT_TOGGLE')} disabled={busy} aria-keyshortcuts="Shift+S" title="Suit up / down (Shift+S)">{spider ? 'Suit down' : 'Suit up'}<kbd>⇧S</kbd></button>
      <button onClick={() => command('MASK_TOGGLE')} disabled={!spider || busy} aria-keyshortcuts="M" title="Mask (M)">Mask<kbd>M</kbd></button>
      <button onClick={() => command('ARMS_TOGGLE')} disabled={!spider || busy} aria-keyshortcuts="A" title="Spider arms (A)">Arms<kbd>A</kbd></button>
      <button onClick={cycleCamera} aria-keyshortcuts="C" title="Camera (C)">Camera<kbd>C</kbd></button>
      <button onClick={() => set({ hud: !hud })} aria-pressed={hud} aria-keyshortcuts="H" title="HUD (H)">HUD<kbd>H</kbd></button>
    </div>
  )
}
