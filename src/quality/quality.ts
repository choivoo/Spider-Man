import { create } from 'zustand'
import { useSettings, type QualityPreset } from '../store/settingsStore'

export type Tier = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA'

export interface QualityConfig {
  tier: Tier
  particles: number
  dprMax: number
  shadowMap: number
  texScale: number      // procedural / KTX2 texture resolution multiplier (1 = 1K-class)
  bloom: boolean
  msaa: number
  lodBias: number       // 0 = best; higher = switch to cheaper LODs sooner
  maxLod: number
  targetFps: number
  armSegments: number   // radial segments on spider-arm tubes
}

export const PRESETS: Record<Tier, QualityConfig> = {
  LOW:    { tier: 'LOW',    particles: 800,   dprMax: 1,   shadowMap: 512,  texScale: 0.5, bloom: false, msaa: 0, lodBias: 1, maxLod: 2, targetFps: 30, armSegments: 8 },
  MEDIUM: { tier: 'MEDIUM', particles: 2000,  dprMax: 1.5, shadowMap: 1024, texScale: 1,   bloom: false, msaa: 0, lodBias: 0.5, maxLod: 2, targetFps: 60, armSegments: 12 },
  HIGH:   { tier: 'HIGH',   particles: 5000,  dprMax: 2,   shadowMap: 2048, texScale: 1,   bloom: true,  msaa: 4, lodBias: 0, maxLod: 2, targetFps: 60, armSegments: 16 },
  ULTRA:  { tier: 'ULTRA',  particles: 10000, dprMax: 2.5, shadowMap: 4096, texScale: 2,   bloom: true,  msaa: 8, lodBias: 0, maxLod: 1, targetFps: 60, armSegments: 20 },
}
const ORDER: Tier[] = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA']

export interface DeviceInfo {
  memory: number | null
  cores: number
  mobile: boolean
  screenPx: number
  gpu: string
  score: number
}

/** Heuristic device capability score → tier. Pure so it can be unit-tested. */
export function scoreDevice(d: Omit<DeviceInfo, 'score'>): { score: number; tier: Tier } {
  let s = 0
  s += d.memory === null ? 2 : d.memory >= 8 ? 4 : d.memory >= 4 ? 3 : d.memory >= 2 ? 1.5 : 0.5
  s += d.cores >= 12 ? 4 : d.cores >= 8 ? 3 : d.cores >= 4 ? 2 : 1
  const g = d.gpu.toLowerCase()
  if (/swiftshader|llvmpipe|software|mali-4|mali-t|adreno \(tm\) [23]\d\d|powervr/.test(g)) s -= 4
  else if (/rtx|radeon rx|apple m\d|geforce (gtx )?(10|16|20|30|40)|arc a|rx \d/.test(g)) s += 4
  else if (/apple gpu|adreno \(tm\) [67]\d\d|mali-g[7-9]/.test(g)) s += 2
  else if (/intel/.test(g)) s += 1
  if (d.mobile) s -= 2.5
  if (d.screenPx > 3840 * 2160 * 0.9 && !/rtx|m\d/.test(g)) s -= 1
  const tier: Tier = s >= 9.5 ? 'ULTRA' : s >= 7 ? 'HIGH' : s >= 4 ? 'MEDIUM' : 'LOW'
  return { score: s, tier: d.mobile && tier === 'ULTRA' ? 'HIGH' : tier }
}

export function readDevice(gl?: WebGLRenderingContext | WebGL2RenderingContext | null): Omit<DeviceInfo, 'score'> {
  const nav = navigator as Navigator & { deviceMemory?: number }
  let gpu = ''
  try {
    const ctx = gl ?? document.createElement('canvas').getContext('webgl2')
    const ext = ctx?.getExtension('WEBGL_debug_renderer_info')
    if (ctx && ext) gpu = String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '')
  } catch { /* ignore */ }
  const mobile = /android|iphone|ipad|ipod|mobile/i.test(nav.userAgent) || (nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent))
  return {
    memory: nav.deviceMemory ?? null,
    cores: nav.hardwareConcurrency ?? 4,
    mobile,
    screenPx: screen.width * screen.height * (window.devicePixelRatio || 1) ** 2,
    gpu,
    ...{},
  }
}

interface QualityStore {
  tier: Tier
  auto: Tier | null
  device: DeviceInfo | null
  fps: number
  config: QualityConfig
  setAuto: (t: Tier, d: DeviceInfo) => void
  setFps: (f: number) => void
  downgrade: () => boolean
  resolve: () => void
}

const resolvePreset = (p: QualityPreset, auto: Tier | null): Tier => (p === 'AUTO' ? auto ?? 'MEDIUM' : p)

export const useQuality = create<QualityStore>((set, get) => ({
  tier: 'MEDIUM', auto: null, device: null, fps: 60, config: PRESETS.MEDIUM,
  setAuto: (t, device) => { set({ auto: t, device }); get().resolve() },
  setFps: (fps) => set({ fps }),
  downgrade: () => {
    const cur = ORDER.indexOf(get().tier)
    if (cur <= 0 || useSettings.getState().quality !== 'AUTO') return false
    set({ auto: ORDER[cur - 1] }); get().resolve(); return true
  },
  resolve: () => {
    const tier = resolvePreset(useSettings.getState().quality, get().auto)
    set({ tier, config: PRESETS[tier] })
  },
}))
useSettings.subscribe(() => useQuality.getState().resolve())

export function detectQuality(gl?: WebGLRenderingContext | WebGL2RenderingContext | null) {
  const d = readDevice(gl)
  const { score, tier } = scoreDevice(d)
  useQuality.getState().setAuto(tier, { ...d, score })
  return tier
}

/** Rolling FPS governor: in AUTO mode, sustained low FPS steps the tier down (never flaps upward). */
export class FpsGovernor {
  private acc = 0
  private frames = 0
  private low = 0
  constructor(private minSeconds = 3) {}
  tick(dt: number) {
    this.acc += dt; this.frames++
    if (this.acc < 1) return
    const fps = this.frames / this.acc
    this.acc = 0; this.frames = 0
    const q = useQuality.getState()
    q.setFps(Math.round(fps))
    const target = q.config.targetFps
    if (fps < target * 0.72) this.low++
    else this.low = Math.max(0, this.low - 1)
    if (this.low >= this.minSeconds) { this.low = 0; q.downgrade() }
  }
}
