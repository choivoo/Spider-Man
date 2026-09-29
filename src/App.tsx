import Stage from './pages/Stage'
import Chat from './ui/Chat'
import CameraBar from './ui/CameraBar'
import HUD from './ui/HUD'
import Controls from './ui/Controls'
import { useHotkeys } from './ui/useHotkeys'
import { useCharacterStore } from './store/characterStore'

export default function App() {
  useHotkeys()
  const spider = useCharacterStore((s) => s.suit.blend > 0.5)
  const sense = useCharacterStore((s) => s.sense)
  return (
    <div className="app" data-theme={spider ? 'spider' : 'peter'}>
      <main className={`stage${sense ? ' sense' : ''}`}>
        <Stage />
        <CameraBar />
        <HUD />
        <Controls />
      </main>
      <aside className="side"><Chat /></aside>
    </div>
  )
}
