import { useEffect, useRef, useState } from 'react'
import { useSettings, DEFAULT_SETTINGS, type QualityPreset } from '../store/settingsStore'
import { useQuality } from '../quality/quality'
import { useCharacterStore } from '../store/characterStore'
import { memory } from '../memory'
import { voice } from '../audio/VoiceManager'
import { audio } from '../audio/AudioManager'
import { usePwa } from '../pwa'
import { director } from '../character/director'
import type { MemoryItem } from '../ai/schema'

const TABS = ['Graphics', 'Audio', 'Voice', 'Subtitles', 'Camera', 'Controls', 'AI Memory', 'Privacy', 'About'] as const
type Tab = (typeof TABS)[number]

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="row"><span className="row-l">{label}{hint && <small>{hint}</small>}</span><span className="row-c">{children}</span></label>
)
const Toggle = ({ v, on }: { v: boolean; on: (b: boolean) => void }) => <input type="checkbox" role="switch" checked={v} onChange={(e) => on(e.target.checked)} />
const Range = ({ v, on, min = 0, max = 1, step = 0.05 }: { v: number; on: (n: number) => void; min?: number; max?: number; step?: number }) => (
  <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(Number(e.target.value))} />
)

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const q = useQuality()
  const pwa = usePwa()
  const [tab, setTab] = useState<Tab>('Graphics')
  const [items, setItems] = useState<MemoryItem[]>(() => [...memory.items])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button, input, select')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab' && ref.current) { // focus trap
        const f = Array.from(ref.current.querySelectorAll<HTMLElement>('button, input, select, a[href]')).filter((x) => !x.hasAttribute('disabled'))
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); prev?.focus?.() }
  }, [onClose])
  useEffect(() => { memory.onChange = () => setItems([...memory.items]); return () => { memory.onChange = null } }, [])

  const exportMemory = () => {
    const blob = new Blob([JSON.stringify(memory.snapshot(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'spider-ai-memory.json'; a.click(); URL.revokeObjectURL(a.href)
  }
  const wipe = async () => {
    if (!confirm('Delete everything Peter remembers about you, the conversation, and all saved settings on this device?')) return
    voice.stop(); await memory.clearAll(); s.reset()
    try { localStorage.removeItem('spider-ai:settings:v1'); localStorage.removeItem('spider-ai:uid') } catch { /* ignore */ }
    useCharacterStore.setState({ messages: [] }); setItems([])
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Settings" ref={ref}>
        <header><h2>Settings</h2><button onClick={onClose} aria-label="Close settings">✕</button></header>
        <div className="modal-body">
          <nav role="tablist" aria-label="Settings sections">
            {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
          </nav>
          <section role="tabpanel" className="panel">
            {tab === 'Graphics' && <>
              <Row label="Quality" hint={`Now: ${q.tier}${q.device ? ` · ${q.fps} fps` : ''}`}>
                <select value={s.quality} onChange={(e) => s.set({ quality: e.target.value as QualityPreset })}>{['AUTO', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'].map((x) => <option key={x}>{x}</option>)}</select>
              </Row>
              <Row label="Bloom glow" hint="Ignored on LOW/MEDIUM"><Toggle v={s.bloom} on={(bloom) => s.set({ bloom })} /></Row>
              <Row label="Reduced motion" hint="Softer camera & fewer idle movements">
                <select value={s.reducedMotion} onChange={(e) => s.set({ reducedMotion: e.target.value as 'auto' | 'on' | 'off' })}><option value="auto">System</option><option value="on">On</option><option value="off">Off</option></select>
              </Row>
              <Row label="Show FPS"><Toggle v={s.showFps} on={(showFps) => s.set({ showFps })} /></Row>
              {q.device && <p className="fine">GPU: {q.device.gpu || 'unknown'} · {q.device.cores} cores · {q.device.memory ?? '?'} GB · score {q.device.score.toFixed(1)} · particles {q.config.particles}</p>}
            </>}
            {tab === 'Audio' && <>
              <Row label="Mute all"><Toggle v={s.muted} on={(muted) => s.set({ muted })} /></Row>
              <Row label="Master volume"><Range v={s.masterVolume} on={(masterVolume) => s.set({ masterVolume })} /></Row>
              <Row label="Effects volume"><Range v={s.sfxVolume} on={(sfxVolume) => s.set({ sfxVolume })} /></Row>
              <button onClick={() => { audio.unlock(); audio.suitComplete() }}>Test sound</button>
            </>}
            {tab === 'Voice' && <>
              <Row label="Character voice (TTS)"><Toggle v={s.voiceEnabled} on={(voiceEnabled) => { s.set({ voiceEnabled }); if (!voiceEnabled) voice.stop() }} /></Row>
              <Row label="Voice input (microphone)"><Toggle v={s.micEnabled} on={(micEnabled) => s.set({ micEnabled })} /></Row>
              <Row label="Voice volume"><Range v={s.voiceVolume} on={(voiceVolume) => s.set({ voiceVolume })} /></Row>
              <Row label="Speaking rate"><Range v={s.voiceRate} min={0.7} max={1.5} on={(voiceRate) => s.set({ voiceRate })} /></Row>
              <button onClick={() => { voice.unlock(); void voice.speak('Hey! Can you hear me okay? 잘 들려?', { emotion: 'happy', intensity: 0.6, spider: false }) }}>Test voice</button>
              <p className="fine">A synthetic preset voice — it does not imitate any real person. Browser voices are used unless the server has a TTS endpoint configured.</p>
            </>}
            {tab === 'Subtitles' && <>
              <Row label="Subtitles"><Toggle v={s.subtitles} on={(subtitles) => s.set({ subtitles })} /></Row>
              <Row label="Text size"><select value={s.textSize} onChange={(e) => s.set({ textSize: e.target.value as 'sm' | 'md' | 'lg' })}><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></Row>
            </>}
            {tab === 'Camera' && <>
              <Row label="Default camera"><select value={s.defaultCamera} onChange={(e) => s.set({ defaultCamera: e.target.value as typeof s.defaultCamera })}>{['face', 'upper', 'full', 'cinematic'].map((x) => <option key={x}>{x}</option>)}</select></Row>
              <Row label="Cinematic transformation camera" hint="Soft zoom during suit-up"><Toggle v={s.cinematicTransform} on={(cinematicTransform) => s.set({ cinematicTransform })} /></Row>
            </>}
            {tab === 'Controls' && <>
              <Row label="Spider HUD"><Toggle v={s.hud} on={(hud) => s.set({ hud })} /></Row>
              <Row label="Let Peter act on his own" hint="Allow the AI to suit up, open the mask, deploy arms"><Toggle v={s.allowAIActions} on={(allowAIActions) => s.set({ allowAIActions })} /></Row>
              <table className="keys"><tbody>
                {[['Shift + S', 'Suit up / down'], ['M', 'Mask'], ['A', 'Spider arms'], ['C', 'Camera mode'], ['H', 'HUD'], ['V', 'Voice input'], ['X', 'Spider sense'], ['B', 'Web shooter'], ['Esc', 'Cancel / close']].map(([k, d]) => <tr key={k}><th><kbd>{k}</kbd></th><td>{d}</td></tr>)}
              </tbody></table>
              <p className="fine">Touch: tap the 🕷 button for controls, long-press it to suit up/down. One finger orbits, pinch zooms.</p>
            </>}
            {tab === 'AI Memory' && <>
              <Row label="Where memory is stored" hint="Cloud needs the server to be configured">
                <select value={s.memoryMode} onChange={(e) => s.set({ memoryMode: e.target.value as typeof s.memoryMode })}><option value="device">This device</option><option value="cloud">Cloud (Supabase)</option><option value="session">This session only</option></select>
              </Row>
              {memory.summary && <details><summary>Conversation summary</summary><p className="fine">{memory.summary}</p></details>}
              <ul className="mem">
                {items.length === 0 && <li className="fine">Nothing remembered yet.</li>}
                {[...items].sort((a, b) => b.importance - a.importance).map((m) => (
                  <li key={m.id}><span className="imp" title="importance">{m.importance}</span><span>{m.content}</span><button aria-label="Forget this" onClick={() => memory.remove(m.id)}>✕</button></li>
                ))}
              </ul>
            </>}
            {tab === 'Privacy' && <>
              <p className="fine">Your messages go to this app's own server, which forwards them to Claude to generate replies. API keys live only on the server. Memory is stored {s.memoryMode === 'device' ? 'on this device' : s.memoryMode === 'cloud' ? 'in your cloud database under a random anonymous id' : 'in RAM only'}; secrets such as passwords or API keys are never saved to memory.</p>
              <div className="btn-row"><button onClick={exportMemory}>Export memory (JSON)</button><button className="danger" onClick={wipe}>Delete all my data</button></div>
              <button onClick={() => s.set({ ...DEFAULT_SETTINGS })}>Reset settings</button>
            </>}
            {tab === 'About' && <>
              <p><b>SPIDER-AI</b> v{__APP_VERSION__}</p>
              {pwa.installed ? <p className="fine">Installed as an app ✓</p> : pwa.canInstall ? <button onClick={() => void pwa.install()}>Install app</button> : pwa.ios ? <p className="fine">To install on iPhone/iPad: tap Share → “Add to Home Screen”.</p> : <p className="fine">Installation is available from your browser’s menu when supported.</p>}
              {pwa.updateReady && <button onClick={pwa.applyUpdate}>Update available — reload</button>}
              <button onClick={() => { director.setReducedMotion(false); alert('UI state reset.') }}>Reset animation state</button>
            </>}
          </section>
        </div>
      </div>
    </div>
  )
}
