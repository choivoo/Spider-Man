import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import { director } from './character/director'
import { useCharacterStore } from './store/characterStore'
import { nano, command } from './transformation'
import { fx, triggerSpiderSense, triggerWebShoot } from './character/SpiderFX'

// Debug/QA handle (also used by Playwright tests)
;(window as unknown as { __spider: unknown }).__spider = { director, store: useCharacterStore, nano, command, fx, triggerSpiderSense, triggerWebShoot }

void import('./memory').then((m) => m.initMemory())
void import('./audio/VoiceManager').then((m) => m.voice.init())
void import('./transformation/cinematic').then((m) => m.initCinematic())
createRoot(document.getElementById('root')!).render(<App />)
