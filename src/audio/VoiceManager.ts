import { director } from '../character/director'
import { useSettings } from '../store/settingsStore'
import { useCharacterStore } from '../store/characterStore'
import { audio } from './AudioManager'
import { voiceParams, chunkText, detectLang } from './emotionVoice'
import { estimateDuration } from '../animation/LipSync'
import type { Emotion } from '../ai/schema'

export interface SpeakOpts { emotion: Emotion; intensity: number; spider: boolean }

/** Adapter pattern (spec §23): swap the TTS engine without touching the rest of the app. */
export interface TTSProvider {
  readonly id: string
  supported(): boolean
  speak(text: string, o: SpeakOpts): Promise<void>
  cancel(): void
}

// ------------------------------------------------------------------ browser voices
class BrowserTTS implements TTSProvider {
  readonly id = 'browser'
  private voices: SpeechSynthesisVoice[] = []
  private token = 0
  constructor() {
    if (this.supported()) {
      const load = () => { this.voices = speechSynthesis.getVoices() }
      load(); speechSynthesis.addEventListener?.('voiceschanged', load)
    }
  }
  supported() { return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined' }

  private pick(lang: string): SpeechSynthesisVoice | undefined {
    const pref = lang.slice(0, 2).toLowerCase()
    const cands = this.voices.filter((v) => v.lang.toLowerCase().startsWith(pref))
    const male = /male|man|daniel|alex|fred|jamie|junior|guy|ryan|david|mark|injoon|minjun|hyunsu/i
    const female = /female|woman|samantha|victoria|zira|heami|sunhi|yuna|siri/i
    return cands.find((v) => male.test(v.name) && !female.test(v.name)) ?? cands.find((v) => !female.test(v.name)) ?? cands[0]
  }

  cancel() { this.token++; if (this.supported()) speechSynthesis.cancel() }

  speak(text: string, o: SpeakOpts): Promise<void> {
    return new Promise((resolve) => {
      if (!this.supported()) return resolve()
      const s = useSettings.getState()
      const my = ++this.token
      speechSynthesis.cancel()
      const lang = detectLang(text, navigator.language || 'en-US')
      const p = voiceParams(o.emotion, o.intensity, o.spider, s.voiceRate)
      const chunks = chunkText(text)
      const voice = this.pick(lang)
      director.beginSpeech(text, { duration: estimateDuration(text, p.rate), external: true })
      let done = false
      const finish = () => { if (done) return; done = true; if (my === this.token) director.endSpeech(); resolve() }
      chunks.forEach((c, i) => {
        const u = new SpeechSynthesisUtterance(c.text)
        u.lang = lang; if (voice) u.voice = voice
        u.pitch = p.pitch; u.rate = p.rate; u.volume = p.volume * s.voiceVolume * (s.muted ? 0 : 1) * s.masterVolume
        u.onboundary = (e) => { if (my === this.token) director.lip.syncToChar(c.offset + e.charIndex) }
        u.onend = () => { if (i === chunks.length - 1) finish() }
        u.onerror = () => { if (i === chunks.length - 1) finish() }
        speechSynthesis.speak(u)
      })
      // safety net: some engines never fire onend
      setTimeout(finish, estimateDuration(text, p.rate) * 1000 * 2.5 + 3000)
    })
  }
}

// ------------------------------------------------------------------ server voices (OpenAI-compatible)
class RemoteTTS implements TTSProvider {
  readonly id = 'remote'
  private token = 0
  private src: AudioBufferSourceNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  enabled = false

  async probe() {
    try { const r = await fetch('/api/tts'); this.enabled = r.ok && Boolean((await r.json()).enabled) } catch { this.enabled = false }
    return this.enabled
  }
  supported() { return this.enabled && !!audio.context }
  cancel() { this.token++; try { this.src?.stop() } catch { /* already stopped */ } this.src = null; if (this.timer) clearInterval(this.timer) }

  async speak(text: string, o: SpeakOpts) {
    const ctx = audio.context
    if (!ctx || !this.enabled) throw new Error('remote tts unavailable')
    const my = ++this.token
    const p = voiceParams(o.emotion, o.intensity, o.spider, useSettings.getState().voiceRate)
    const res = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, speed: p.rate }) })
    if (!res.ok) throw new Error('tts ' + res.status)
    const buf = await ctx.decodeAudioData(await res.arrayBuffer())
    if (my !== this.token) return
    const src = ctx.createBufferSource(); src.buffer = buf
    const gain = ctx.createGain(); gain.gain.value = p.volume * useSettings.getState().voiceVolume
    const an = ctx.createAnalyser(); an.fftSize = 512
    src.connect(gain).connect(an); gain.connect(audio.destination ?? ctx.destination)
    this.src = src
    director.beginSpeech(text, { duration: buf.duration, external: true })
    director.lip.fitTo(buf.duration)
    const data = new Uint8Array(an.fftSize)
    this.timer = setInterval(() => {
      an.getByteTimeDomainData(data)
      let sum = 0; for (const v of data) { const x = (v - 128) / 128; sum += x * x }
      director.lip.amplitude = Math.min(1, 0.35 + Math.sqrt(sum / data.length) * 5) // real audio energy drives mouth openness
    }, 40)
    await new Promise<void>((resolve) => { src.onended = () => resolve(); src.start() })
    if (this.timer) clearInterval(this.timer)
    if (my === this.token) director.endSpeech()
  }
}

// ------------------------------------------------------------------ manager
class VoiceManager {
  private browser = new BrowserTTS()
  private remote = new RemoteTTS()
  private current: TTSProvider | null = null

  async init() { await this.remote.probe() }
  get ttsSupported() { return this.browser.supported() || this.remote.enabled }

  /** Speak a reply. Falls back gracefully: remote → browser → silent text-timed lip-sync. */
  async speak(text: string, o: SpeakOpts) {
    this.stop()
    const s = useSettings.getState()
    if (!s.voiceEnabled || s.muted || !text.trim()) { director.beginSpeech(text); return }
    const providers: TTSProvider[] = [this.remote, this.browser].filter((p) => p.supported())
    for (const p of providers) {
      this.current = p
      try { await p.speak(text, o); return } catch { /* try the next provider */ }
    }
    director.beginSpeech(text)
  }
  stop() { this.remote.cancel(); this.browser.cancel(); director.endSpeech() }
  /** iOS/Android need a user gesture before the first utterance. */
  unlock() {
    try { if (this.browser.supported()) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u) } } catch { /* ignore */ }
  }
}
export const voice = new VoiceManager()

// ------------------------------------------------------------------ speech recognition
interface SR extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  start(): void; stop(): void; abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type SRCtor = new () => SR

export class SpeechInput {
  private rec: SR | null = null
  private finalText = ''
  static get Ctor(): SRCtor | null {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
  }
  static supported() { return typeof window !== 'undefined' && !!SpeechInput.Ctor }

  start(onFinal: (text: string) => void) {
    const C = SpeechInput.Ctor
    const st = useCharacterStore.getState()
    if (!C) { st.setVoiceState({ error: 'Speech recognition is not supported in this browser.' }); return false }
    if (!useSettings.getState().micEnabled) { st.setVoiceState({ error: 'Microphone is disabled in settings.' }); return false }
    voice.stop() // barge-in
    audio.unlock(); voice.unlock()
    const rec = new C()
    rec.lang = navigator.language || 'ko-KR'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1
    this.finalText = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) this.finalText += r[0].transcript
        else interim += r[0].transcript
      }
      useCharacterStore.getState().setVoiceState({ interim: this.finalText + interim })
    }
    rec.onerror = (e) => {
      const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Microphone permission denied.' : e.error === 'no-speech' ? '' : `Voice input error: ${e.error}`
      useCharacterStore.getState().setVoiceState({ error: msg, listening: false })
    }
    rec.onend = () => {
      useCharacterStore.getState().setVoiceState({ listening: false, interim: '' })
      director.look.userBias = 1
      const t = this.finalText.trim()
      this.rec = null
      if (t) onFinal(t)
    }
    try { rec.start() } catch { return false }
    this.rec = rec
    st.setVoiceState({ listening: true, interim: '', error: '' })
    director.look.lookAtUser(); director.setEmotion('curious', 0.35)
    return true
  }
  stop() { try { this.rec?.stop() } catch { /* ignore */ } }
  cancel() { try { this.rec?.abort() } catch { /* ignore */ } this.rec = null; useCharacterStore.getState().setVoiceState({ listening: false, interim: '' }) }
  get listening() { return !!this.rec }
}
export const speechInput = new SpeechInput()
