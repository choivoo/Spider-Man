import { z } from 'zod'

/** Shared by the browser and the serverless function — the single source of truth for the AI contract. */

export const EMOTIONS = [
  'neutral', 'happy', 'excited', 'curious', 'thinking', 'embarrassed',
  'worried', 'sad', 'serious', 'surprised', 'confident', 'focused',
] as const
export type Emotion = (typeof EMOTIONS)[number]

export const GESTURES = [
  'none', 'nod', 'shake_head', 'wave', 'cross_arms', 'hands_in_pocket', 'lean_forward',
  'shrug', 'think_chin', 'laugh', 'point', 'scratch_head', 'facepalm', 'ready_stance',
] as const
export type Gesture = (typeof GESTURES)[number]

export const FACES = [
  'neutral', 'smile', 'laugh', 'curious', 'confused', 'embarrassed', 'surprised', 'serious', 'worried', 'sad',
] as const
export type FaceName = (typeof FACES)[number]

export const EYE_EXPRESSIONS = ['normal', 'happy', 'confused', 'angry', 'surprised', 'focused'] as const
export type EyeExpression = (typeof EYE_EXPRESSIONS)[number]

export const SUIT_ACTIONS = [
  'none', 'suit_up', 'suit_down', 'mask_open', 'mask_close', 'web_shoot', 'spider_sense',
] as const
export type SuitAction = (typeof SUIT_ACTIONS)[number]

export const ARM_ACTIONS = ['none', 'deploy', 'retract', 'defense', 'attack', 'balance', 'pose'] as const
export type ArmAction = (typeof ARM_ACTIONS)[number]

export const MEMORY_TYPES = [
  'userFacts', 'sharedExperiences', 'importantEvents', 'longTermMemory',
] as const
export type MemoryType = (typeof MEMORY_TYPES)[number]

export const memoryCandidateSchema = z.object({
  content: z.string(),
  type: z.enum(MEMORY_TYPES),
  importance: z.number(),
  tags: z.array(z.string()),
})

export const characterResponseSchema = z.object({
  dialogue: z.string(),
  emotion: z.enum(EMOTIONS),
  emotionIntensity: z.number(),
  gesture: z.enum(GESTURES),
  face: z.enum(FACES),
  eyeExpression: z.enum(EYE_EXPRESSIONS),
  lookAtUser: z.boolean(),
  animation: z.string(),
  suitAction: z.enum(SUIT_ACTIONS),
  armAction: z.enum(ARM_ACTIONS),
  memoryCandidate: memoryCandidateSchema.nullable(),
})

export type CharacterResponse = {
  dialogue: string
  emotion: Emotion
  emotionIntensity: number
  gesture: Gesture
  face: FaceName
  eyeExpression: EyeExpression
  lookAtUser: boolean
  animation: string
  suitAction: SuitAction
  armAction: ArmAction
  memoryCandidate: { content: string; type: MemoryType; importance: number; tags: string[] } | null
}

export interface MemoryItem {
  id: string
  type: MemoryType | 'shortTermMemory' | 'conversationSummary'
  content: string
  importance: number // 0..100
  timestamp: number
  tags: string[]
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export interface CharacterVars {
  trust: number; friendship: number; confidence: number; stress: number; energy: number
  curiosity: number; embarrassment: number; heroConfidence: number; conversationDepth: number
}

export interface ChatRequest {
  mode: 'chat' | 'summarize'
  form: 'peter' | 'spider'
  maskOpen: boolean
  armsDeployed: boolean
  messages: ChatTurn[]
  memories: MemoryItem[]
  summary: string
  vars: CharacterVars
  emotion: { emotion: Emotion; intensity: number }
  /** Language hint (BCP-47) — the character answers in the user's language. */
  locale?: string
  /** Allow the model to trigger suit actions (user setting). */
  allowActions: boolean
  /** Seconds since the last suit toggle — helps the model avoid over-transforming. */
  secondsSinceLastTransform?: number
}

export interface ChatResponse {
  response: CharacterResponse
  source: 'claude' | 'offline'
  summary?: string
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback

/** Tolerant parser: never throws, always returns a renderable response. */
export function sanitizeResponse(raw: unknown): CharacterResponse {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const mc = r.memoryCandidate as Record<string, unknown> | null | undefined
  let memoryCandidate: CharacterResponse['memoryCandidate'] = null
  if (mc && typeof mc === 'object' && typeof mc.content === 'string' && mc.content.trim()) {
    memoryCandidate = {
      content: mc.content.trim().slice(0, 400),
      type: pick(MEMORY_TYPES, mc.type, 'userFacts'),
      importance: clamp(Number(mc.importance) || 30, 0, 100),
      tags: Array.isArray(mc.tags) ? mc.tags.filter((t): t is string => typeof t === 'string').slice(0, 6) : [],
    }
  }
  return {
    dialogue: typeof r.dialogue === 'string' && r.dialogue.trim() ? r.dialogue.trim().slice(0, 1200) : '…',
    emotion: pick(EMOTIONS, r.emotion, 'neutral'),
    emotionIntensity: clamp(Number(r.emotionIntensity) || 0.4, 0, 1),
    gesture: pick(GESTURES, r.gesture, 'none'),
    face: pick(FACES, r.face, 'neutral'),
    eyeExpression: pick(EYE_EXPRESSIONS, r.eyeExpression, 'normal'),
    lookAtUser: r.lookAtUser !== false,
    animation: typeof r.animation === 'string' ? r.animation.slice(0, 48) : '',
    suitAction: pick(SUIT_ACTIONS, r.suitAction, 'none'),
    armAction: pick(ARM_ACTIONS, r.armAction, 'none'),
    memoryCandidate,
  }
}

export const DEFAULT_VARS: CharacterVars = {
  trust: 40, friendship: 30, confidence: 45, stress: 15, energy: 60,
  curiosity: 65, embarrassment: 10, heroConfidence: 50, conversationDepth: 0,
}
