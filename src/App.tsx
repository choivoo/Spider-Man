import { useEffect } from 'react'
import Stage from './pages/Stage'
import Chat from './ui/Chat'
import CameraBar from './ui/CameraBar'
import HUD from './ui/HUD'
import Controls from './ui/Controls'
import MobileWheel from './ui/MobileWheel'
import Subtitles from './ui/Subtitles'
import ArmModes from './ui/ArmModes'
import { useHotkeys } from './ui/useHotkeys'
import { useIsMobile } from './ui/useMobile'
import { useCharacterStore } from './store/characterStore'
import { command } from './transformation'

export default function App() {
  useHotkeys()
  const mobile = useIsMobile()
  const spider = useCharacterStore((s) => s.suit.blend > 0.5)
  const sense = useCharacterStore((s) => s.sense)
  useEffect(() => {
    // PWA shortcut: /?action=suit
    if (new URLSearchParams(location.search).get('action') === 'suit') setTimeout(() => command('SUIT_UP'), 2500)
  }, [])
  return (
    <div className={`app${mobile ? ' mobile' : ''}`} data-theme={spider ? 'spider' : 'peter'}>
      <main className={`stage${sense ? ' sense' : ''}`}>
        <Stage />
        <CameraBar />
        <HUD />
        <Subtitles />
        <ArmModes />
        {mobile ? <MobileWheel /> : <Controls />}
      </main>
      <aside className="side"><Chat mobile={mobile} /></aside>
    </div>
  )
}
