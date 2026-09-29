import Stage from './pages/Stage'
import Chat from './ui/Chat'
import CameraBar from './ui/CameraBar'
import { useHotkeys } from './ui/useHotkeys'

export default function App() {
  useHotkeys()
  return (
    <div className="app" data-theme="peter">
      <main className="stage">
        <Stage />
        <CameraBar />
      </main>
      <aside className="side"><Chat /></aside>
    </div>
  )
}
