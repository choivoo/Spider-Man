import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type QualityPreset = 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA'
export type MemoryMode = 'device' | 'cloud' | 'session'

/** Non-sensitive preferences only. API keys and secrets never touch the client (see docs/ARCHITECTURE.md). */
export interface Settings {
  quality: QualityPreset
  reducedMotion: 'auto' | 'on' | 'off'
  masterVolume: number
  sfxVolume: number
  voiceVolume: number
  muted: boolean
  voiceEnabled: boolean      // TTS output
  micEnabled: boolean        // STT input allowed
  voiceRate: number
  subtitles: boolean
  textSize: 'sm' | 'md' | 'lg'
  defaultCamera: 'face' | 'upper' | 'full' | 'cinematic'
  cinematicTransform: boolean
  hud: boolean
  allowAIActions: boolean
  memoryMode: MemoryMode
  showFps: boolean
  bloom: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'AUTO', reducedMotion: 'auto', masterVolume: 0.8, sfxVolume: 0.8, voiceVolume: 1, muted: false,
  voiceEnabled: true, micEnabled: true, voiceRate: 1.05, subtitles: true, textSize: 'md', defaultCamera: 'full',
  cinematicTransform: true, hud: true, allowAIActions: true, memoryMode: 'device', showFps: false, bloom: true,
}

interface SettingsStore extends Settings {
  set: (p: Partial<Settings>) => void
  reset: () => void
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (p) => set(p),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'spider-ai:settings:v1',
      version: 1,
      partialize: (s) => {
        const { set: _s, reset: _r, ...rest } = s
        void _s; void _r
        return rest
      },
    },
  ),
)

export function prefersReducedMotion(): boolean {
  const s = useSettings.getState().reducedMotion
  if (s === 'on') return true
  if (s === 'off') return false
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
