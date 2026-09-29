import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import { director } from './character/director'
import { useCharacterStore } from './store/characterStore'
import { nano, command } from './transformation'
import { fx, triggerSpiderSense, triggerWebShoot } from './character/SpiderFX'
import { installGlobalErrorHandlers, log } from './log'
import { useBoot } from './boot'
import { probeBackend } from './ai/claude'
import { initPwa } from './pwa'
import { initMemory } from './memory'
import { voice } from './audio/VoiceManager'
import { initCinematic } from './transformation/cinematic'

installGlobalErrorHandlers()

// Debug/QA handle (also used by Playwright tests)
;(window as unknown as { __spider: unknown }).__spider = { director, store: useCharacterStore, nano, command, fx, triggerSpiderSense, triggerWebShoot }

if (import.meta.env.DEV) {
  // Dev tool: export the procedural civilian as a GLB (used to smoke-test the drop-in GLB adapter)
  ;(window as unknown as { __exportGLB: () => Promise<string> }).__exportGLB = async () => {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
    const root = director.anim!.rig.root
    const buf = await new Promise<ArrayBuffer>((res, rej) => new GLTFExporter().parse(root, (r) => res(r as ArrayBuffer), rej, { binary: true, onlyVisible: true }))
    let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
    return btoa(s)
  }
}
initPwa()
initMemory().catch((e) => { log.error('memory.init', { message: String(e) }); useBoot.getState().mark('memory') })
void voice.init()
initCinematic()
void probeBackend().then((c) => { useCharacterStore.getState().setConnection(c); useBoot.getState().mark('personality') })

createRoot(document.getElementById('root')!).render(<App />)
