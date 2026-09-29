import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import { director } from './character/director'
import { useCharacterStore } from './store/characterStore'

// Debug/QA handle (also used by Playwright tests)
;(window as unknown as { __spider: unknown }).__spider = { director, store: useCharacterStore }

void import('./memory').then((m) => m.initMemory())
createRoot(document.getElementById('root')!).render(<App />)
