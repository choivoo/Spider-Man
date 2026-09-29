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

export type Connection = 'ok' | 'offline-demo' | 'unavailable'

interface CharacterStore {
  messages: Message[]
  busy: boolean
  connection: Connection
  emotion: { emotion: Emotion; intensity: number }
  speaking: boolean
  cameraMode: CameraMode
  vars: CharacterVars
  addMessage: (m: Omit<Message, 'id' | 'ts'>) => Message
  setBusy: (b: boolean) => void
  setSpeaking: (b: boolean) => void
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
  cameraMode: 'full',
  vars: { ...DEFAULT_VARS },
  addMessage: (m) => {
    const msg: Message = { ...m, id: `m${Date.now()}-${n++}`, ts: Date.now() }
    set((s) => ({ messages: [...s.messages, msg] }))
    return msg
  },
  setBusy: (busy) => set({ busy }),
  setSpeaking: (speaking) => set({ speaking }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setConnection: (connection) => set({ connection }),
  setEmotion: (emotion, intensity) => set({ emotion: { emotion, intensity } }),
  patchVars: (p) => set((s) => ({ vars: { ...s.vars, ...p } })),
}))
