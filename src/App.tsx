import Stage from './pages/Stage'
import Chat from './ui/Chat'

export default function App() {
  return (
    <div className="app" data-theme="peter">
      <main className="stage"><Stage /></main>
      <aside className="side"><Chat /></aside>
    </div>
  )
}
