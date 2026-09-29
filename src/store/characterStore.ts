import { create } from 'zustand'
import { DEFAULT_VARS, type CharacterVars, type Emotion } from '../ai/schema'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  emotion?: Emotion
}

export type CameraMode = 'face' | 'upper' | 'full' | 'cinematic'

export interface SuitStatus { form: 'CIVILIAN' | 'SPIDER'; phase: 'IDLE' | 'SUIT_UP' | 'SUIT_DOWN'; mask: string; arms: string; armsMode: string; blend: number; label: string }

export type Connection = 'ok' | 'offline-demo' | 'unavailable'

interface CharacterStore {
  messages: Message[]
  busy: boolean
  connection: Connection
  emotion: { emotion: Emotion; intensity: number }
  speaking: boolean
  sense: boolean
  suit: SuitStatus
  cameraMode: CameraMode
  vars: CharacterVars
  addMessage: (m: Omit<Message, 'id' | 'ts'>) => Message
  setBusy: (b: boolean) => void
  setSpeaking: (b: boolean) => void
  setSense: (b: boolean) => void
  setSuit: (s: SuitStatus) => void
  setCameraMode: (m: CameraMode) => void
  setConnection: (c: Connection) => void
  setEmotion: (emotion: Emotion, intensity: number) => void
  patchVars: (p: Partial<CharacterVars>) => void
}

let n = 0
export const useCharacterStore = create<CharacterStore>((set) => ({
  messages: [],
  busy: false,
  connection: 'ok',
  emotion: { emotion: 'neutral', intensity: 0.3 },
  speaking: false,
  sense: false,
  suit: { form: 'CIVILIAN', phase: 'IDLE', mask: 'MASK_OPEN', arms: 'ARMS_RETRACTED', armsMode: 'IDLE', blend: 0, label: 'CIVILIAN_IDLE' },
  cameraMode: 'full',
  vars: { ...DEFAULT_VARS },
  addMessage: (m) => {
    const msg: Message = { ...m, id: `m${Date.now()}-${n++}`, ts: Date.now() }
    set((s) => ({ messages: [...s.messages, msg] }))
    return msg
  },
  setBusy: (busy) => set({ busy }),
  setSpeaking: (speaking) => set({ speaking }),
  setSense: (sense) => set({ sense }),
  setSuit: (suit) => set({ suit }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setConnection: (connection) => set({ connection }),
  setEmotion: (emotion, intensity) => set({ emotion: { emotion, intensity } }),
  patchVars: (p) => set((s) => ({ vars: { ...s.vars, ...p } })),
}))
