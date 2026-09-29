import { lazy, Suspense, useEffect, useState } from 'react'
import Chat from './ui/Chat'
import CameraBar from './ui/CameraBar'
import HUD from './ui/HUD'
import Controls from './ui/Controls'
import MobileWheel from './ui/MobileWheel'
import Subtitles from './ui/Subtitles'
import ArmModes from './ui/ArmModes'
import LoadingScreen from './ui/LoadingScreen'
import ErrorBoundary from './ui/ErrorBoundary'
import SettingsModal from './ui/SettingsModal'
import { useHotkeys } from './ui/useHotkeys'
import { useIsMobile } from './ui/useMobile'
import { useSettingsEffects } from './ui/useSettingsEffects'
import { useCharacterStore } from './store/characterStore'
import { useSettings } from './store/settingsStore'
import { useQuality } from './quality/quality'
import { useBoot } from './boot'
import { command } from './transformation'

// three.js + the scene are the heavy part: load them after the shell so the loading screen appears immediately
const Stage = lazy(() => import('./pages/Stage'))

export default function App() {
  useHotkeys()
  useSettingsEffects()
  const mobile = useIsMobile()
  const spider = useCharacterStore((s) => s.suit.blend > 0.5)
  const sense = useCharacterStore((s) => s.sense)
  const showFps = useSettings((s) => s.showFps)
  const fps = useQuality((s) => s.fps)
  const gfxError = useBoot((s) => s.gfxError)
  const [settings, setSettings] = useState(false)
  useEffect(() => {
    // PWA shortcut: /?action=suit
    if (new URLSearchParams(location.search).get('action') === 'suit') setTimeout(() => command('SUIT_UP'), 3000)
  }, [])
  return (
    <div className={`app${mobile ? ' mobile' : ''}`} data-theme={spider ? 'spider' : 'peter'}>
      <main className={`stage${sense ? ' sense' : ''}`}>
        <ErrorBoundary label="The 3D view" fallback={(retry) => (
          <div className="fatal" role="alert"><h2>3D view unavailable</h2><p>Your browser or device couldn’t start WebGL. You can still chat.</p><button onClick={retry}>Try again</button></div>
        )}>
          <Suspense fallback={null}><Stage /></Suspense>
        </ErrorBoundary>
        {gfxError && <div className="gfx-error" role="status">{gfxError}</div>}
        <CameraBar onSettings={() => setSettings(true)} />
        <HUD />
        <Subtitles />
        <ArmModes />
        {mobile ? <MobileWheel /> : <Controls />}
        {showFps && <div className="fps">{fps} fps</div>}
      </main>
      <aside className="side"><ErrorBoundary label="Chat"><Chat mobile={mobile} /></ErrorBoundary></aside>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
      <LoadingScreen />
    </div>
  )
}
