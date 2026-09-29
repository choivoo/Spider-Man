import { describe, it, expect } from 'vitest'
import { sanitizeResponse } from '../src/ai/schema'
import { offlineReply } from '../src/ai/offlineBrain'
import type { ChatRequest } from '../src/ai/schema'
import { DEFAULT_VARS } from '../src/ai/schema'

const req = (text: string, form: 'peter' | 'spider' = 'peter'): ChatRequest => ({
  mode: 'chat', form, maskOpen: false, armsDeployed: false, messages: [{ role: 'user', content: text }],
  memories: [], summary: '', vars: DEFAULT_VARS, emotion: { emotion: 'neutral', intensity: 0.3 }, allowActions: true,
})

describe('sanitizeResponse', () => {
  it('survives garbage', () => {
    for (const bad of [null, undefined, 5, 'x', [], {}]) {
      const r = sanitizeResponse(bad)
      expect(r.dialogue.length).toBeGreaterThan(0)
      expect(r.emotion).toBe('neutral')
      expect(r.suitAction).toBe('none')
    }
  })
  it('clamps and validates enums', () => {
    const r = sanitizeResponse({ dialogue: 'hi', emotion: 'excited', emotionIntensity: 9, gesture: 'backflip', suitAction: 'suit_up', memoryCandidate: { content: 'x', type: 'nope', importance: 500, tags: ['a', 3] } })
    expect(r.emotionIntensity).toBe(1)
    expect(r.gesture).toBe('none')
    expect(r.suitAction).toBe('suit_up')
    expect(r.memoryCandidate).toEqual({ content: 'x', type: 'userFacts', importance: 100, tags: ['a'] })
  })
})

describe('offline brain', () => {
  it('suits up from civilian, not from spider', () => {
    expect(offlineReply(req('슈트 입어봐')).suitAction).toBe('suit_up')
    expect(offlineReply(req('슈트 입어봐', 'spider')).suitAction).toBe('none')
  })
  it('suits down from spider', () => {
    expect(offlineReply(req('슈트 벗어', 'spider')).suitAction).toBe('suit_down')
  })
})
