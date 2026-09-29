import { useSettings } from '../store/settingsStore'

/**
 * WebAudio SFX (spec §39). Every sound is synthesised at runtime — no asset files, works offline.
 * The context is created lazily on the first user gesture (browser autoplay rules).
 */
type Node = AudioNode

class AudioManager {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfx!: GainNode
  private noiseBuf: AudioBuffer | null = null

  /** call from a user gesture (click / keydown) */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
      this.master = this.ctx.createGain(); this.sfx = this.ctx.createGain()
      this.sfx.connect(this.master); this.master.connect(this.ctx.destination)
      const n = this.ctx.sampleRate * 2
      this.noiseBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate)
      const d = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
      this.applyVolume()
      useSettings.subscribe(() => this.applyVolume())
    } catch { this.ctx = null }
  }
  get context() { return this.ctx }
  get destination(): Node | null { return this.master ?? null }

  applyVolume() {
    if (!this.ctx) return
    const s = useSettings.getState()
    this.master.gain.value = s.muted ? 0 : s.masterVolume
    this.sfx.gain.value = s.sfxVolume
  }

  private get t() { return this.ctx!.currentTime }
  private ok() { return !!this.ctx && this.ctx.state !== 'closed' && !useSettings.getState().muted }

  private env(g: GainNode, t0: number, a: number, peak: number, d: number) {
    g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d)
  }
  private noise(t0: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number, attack = 0.02, out?: Node) {
    const c = this.ctx!
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur)
    const g = c.createGain(); this.env(g, t0, attack, peak, Math.max(0.01, dur - attack))
    src.connect(f).connect(g).connect(out ?? this.sfx)
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05)
  }
  private tone(t0: number, dur: number, type: OscillatorType, f0: number, f1: number, peak: number, attack = 0.01, out?: Node) {
    const c = this.ctx!
    const o = c.createOscillator(); o.type = type
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur)
    const g = c.createGain(); this.env(g, t0, attack, peak, Math.max(0.01, dur - attack))
    o.connect(g).connect(out ?? this.sfx); o.start(t0); o.stop(t0 + dur + 0.05)
  }

  // ---------- SFX ----------
  nanoActivation() {
    if (!this.ok()) return
    const t = this.t
    this.tone(t, 0.55, 'sine', 320, 2200, 0.16, 0.05)
    this.tone(t, 0.55, 'triangle', 326, 2260, 0.08, 0.05)
    this.tone(t + 0.02, 0.4, 'sine', 4400, 6200, 0.03, 0.05)
    this.noise(t, 0.25, 'highpass', 3000, 6000, 0.7, 0.06)
  }
  nanoMovement(sec = 1.9) {
    if (!this.ok()) return
    const t = this.t, c = this.ctx!
    // granular shimmer: noise through a sweeping band-pass, amplitude-modulated
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(3800, t + sec * 0.6); f.frequency.exponentialRampToValueAtTime(1400, t + sec)
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 0.25); g.gain.setValueAtTime(0.11, t + sec - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + sec)
    const lfo = c.createOscillator(); lfo.frequency.value = 38
    const lg = c.createGain(); lg.gain.value = 0.06
    lfo.connect(lg).connect(g.gain)
    src.connect(f).connect(g).connect(this.sfx)
    src.start(t, Math.random()); src.stop(t + sec + 0.05); lfo.start(t); lfo.stop(t + sec + 0.05)
    this.tone(t, sec, 'sawtooth', 110, 220, 0.025, 0.2)
  }
  maskClose() {
    if (!this.ok()) return
    const t = this.t
    this.noise(t, 0.34, 'lowpass', 3200, 500, 0.8, 0.14, 0.04)
    this.tone(t + 0.3, 0.09, 'square', 1900, 900, 0.07, 0.002)
    this.noise(t + 0.3, 0.06, 'highpass', 4500, 7000, 0.7, 0.1, 0.002)
    this.tone(t + 0.3, 0.25, 'sine', 180, 90, 0.12, 0.005)
  }
  maskOpen() {
    if (!this.ok()) return
    const t = this.t
    this.tone(t, 0.08, 'square', 900, 1900, 0.06, 0.002)
    this.noise(t + 0.04, 0.4, 'lowpass', 500, 3400, 0.8, 0.12, 0.05)
  }
  suitComplete() {
    if (!this.ok()) return
    const t = this.t
    this.tone(t, 0.6, 'sine', 95, 38, 0.32, 0.005)
    this.noise(t, 0.16, 'lowpass', 900, 200, 0.7, 0.16, 0.002)
    for (const [i, f] of [523.25, 659.25, 783.99, 1046.5].entries()) this.tone(t + 0.04 + i * 0.03, 1.1, 'triangle', f, f * 0.995, 0.05, 0.02)
    this.tone(t + 0.05, 0.9, 'sine', 2093, 2093, 0.02, 0.05)
  }
  suitDownComplete() {
    if (!this.ok()) return
    const t = this.t
    this.tone(t, 0.5, 'sine', 140, 55, 0.22, 0.005)
    this.noise(t, 0.2, 'bandpass', 2600, 600, 1.2, 0.09, 0.002)
  }
  armsDeploy() {
    if (!this.ok()) return
    const t = this.t
    this.noise(t, 0.28, 'lowpass', 1500, 500, 0.8, 0.1, 0.03) // cover
    for (let i = 0; i < 4; i++) {
      const s = t + 0.32 + i * 0.16
      this.tone(s, 0.42, 'sawtooth', 320 + i * 40, 900 + i * 80, 0.05, 0.03)
      this.noise(s, 0.06, 'highpass', 3500, 6500, 0.9, 0.09, 0.002)
      this.noise(s + 0.32, 0.05, 'bandpass', 2200, 1600, 3, 0.1, 0.002)
      this.tone(s + 0.34, 0.14, 'sine', 1560, 1500, 0.05, 0.002)
    }
    this.tone(t + 1.15, 0.5, 'sine', 1200, 1180, 0.05, 0.003)
    this.tone(t + 1.15, 0.5, 'sine', 1810, 1800, 0.035, 0.003)
  }
  armsRetract() {
    if (!this.ok()) return
    const t = this.t
    for (let i = 0; i < 4; i++) {
      const s = t + i * 0.1
      this.tone(s, 0.36, 'sawtooth', 900, 300, 0.04, 0.02)
      this.noise(s + 0.32, 0.05, 'highpass', 4000, 6500, 0.9, 0.08, 0.002)
    }
    this.noise(t + 0.75, 0.3, 'lowpass', 500, 1500, 0.8, 0.09, 0.03)
    this.tone(t + 0.95, 0.12, 'square', 1500, 700, 0.05, 0.002)
  }
  spiderSense() {
    if (!this.ok()) return
    const t = this.t, c = this.ctx!
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95)
    g.connect(this.sfx)
    for (const d of [0, 7, -9]) {
      const o = c.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.32); o.frequency.exponentialRampToValueAtTime(760, t + 0.9)
      o.detune.value = d * 4
      const lfo = c.createOscillator(); lfo.frequency.value = 26
      const lg = c.createGain(); lg.gain.value = 40
      lfo.connect(lg).connect(o.detune)
      o.connect(g); o.start(t); o.stop(t + 1); lfo.start(t); lfo.stop(t + 1)
    }
    this.noise(t, 0.5, 'highpass', 2500, 8000, 0.7, 0.04, 0.05)
  }
  webShooter() {
    if (!this.ok()) return
    const t = this.t
    this.noise(t, 0.22, 'bandpass', 5200, 900, 2.2, 0.16, 0.004)
    this.tone(t, 0.14, 'sine', 1400, 300, 0.09, 0.002)
    this.tone(t + 0.16, 0.08, 'triangle', 220, 120, 0.06, 0.002)
  }
  click() {
    if (!this.ok()) return
    this.tone(this.t, 0.05, 'square', 1400, 900, 0.03, 0.002)
  }
}

export const audio = new AudioManager()
// Browsers require a gesture; unlock on the first one.
if (typeof window !== 'undefined') {
  const un = () => { audio.unlock(); window.removeEventListener('pointerdown', un); window.removeEventListener('keydown', un) }
  window.addEventListener('pointerdown', un); window.addEventListener('keydown', un)
}
