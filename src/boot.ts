import { create } from 'zustand'

export type BootStep = 'character' | 'personality' | 'model' | 'memory'
export const BOOT_STEPS: { id: BootStep; label: string }[] = [
  { id: 'character', label: 'Initializing Character' },
  { id: 'personality', label: 'Loading neural personality' },
  { id: 'model', label: 'Loading 3D model' },
  { id: 'memory', label: 'Preparing memory' },
]

interface BootStore {
  done: Record<BootStep, boolean>
  ready: boolean
  gfxError: string
  mark: (s: BootStep) => void
  setGfxError: (m: string) => void
  finish: () => void
}

export const useBoot = create<BootStore>((set, get) => ({
  done: { character: false, personality: false, model: false, memory: false },
  ready: false,
  gfxError: '',
  mark: (s) => { set((st) => ({ done: { ...st.done, [s]: true } })) },
  setGfxError: (gfxError) => set({ gfxError }),
  finish: () => { if (!get().ready) set({ ready: true }) },
}))
