import { describe, it, expect } from 'vitest'
import { updateVars, decayEmotion, baselineEmotion, relaxVars } from '../src/ai/emotions'
import { planActions, AI_TRANSFORM_COOLDOWN_MS, type ActionContext } from '../src/ai/actions'
import { sanitizeResponse, DEFAULT_VARS } from '../src/ai/schema'
import { sanitizeForSpeech, VarietyGuard } from '../src/ai/personality'

const ctx = (o: Partial<ActionContext> = {}): ActionContext => ({
  form: 'peter', transforming: false, maskOpen: false, armsDeployed: false, allowActions: true,
  now: 1_000_000, lastTransformAt: 0, lastEffectAt: 0, ...o,
})

describe('vars', () => {
  it('stay in 0..100 after many turns', () => {
    let v = { ...DEFAULT_VARS }
    for (let i = 0; i < 500; i++) v = updateVars(v, { userText: '고마워 정말 최고야'.repeat(5), response: sanitizeResponse({ dialogue: 'x', emotion: i % 2 ? 'excited' : 'worried', emotionIntensity: 1 }), form: 'spider' })
    for (const val of Object.values(v)) { expect(val).toBeGreaterThanOrEqual(0); expect(val).toBeLessThanOrEqual(100) }
  })
  it('relax toward baseline', () => {
    const v = relaxVars({ ...DEFAULT_VARS, stress: 90 }, 120)
    expect(v.stress).toBeLessThan(90)
  })
  it('emotion decays to baseline', () => {
    let e = { emotion: 'excited' as const, intensity: 1 }
    const base = baselineEmotion(DEFAULT_VARS)
    for (let i = 0; i < 300; i++) e = decayEmotion(e, base, 0.5) as typeof e
    expect(e.emotion).toBe(base.emotion)
  })
})

describe('planActions', () => {
  const r = (o: object) => sanitizeResponse({ dialogue: 'hi', ...o })
  it('gates by form', () => {
    expect(planActions(r({ suitAction: 'suit_up' }), ctx())).toEqual([{ type: 'SUIT_UP' }])
    expect(planActions(r({ suitAction: 'suit_down' }), ctx())).toEqual([])
    expect(planActions(r({ suitAction: 'mask_open' }), ctx())).toEqual([])
    expect(planActions(r({ suitAction: 'mask_open' }), ctx({ form: 'spider' }))).toEqual([{ type: 'MASK_OPEN' }])
  })
  it('respects cooldown, transforming lock and the user setting', () => {
    const now = 1_000_000
    expect(planActions(r({ suitAction: 'suit_up' }), ctx({ lastTransformAt: now - AI_TRANSFORM_COOLDOWN_MS + 1000 }))).toEqual([])
    expect(planActions(r({ suitAction: 'suit_up' }), ctx({ transforming: true }))).toEqual([])
    expect(planActions(r({ suitAction: 'suit_up' }), ctx({ allowActions: false }))).toEqual([])
  })
  it('arms only when spider', () => {
    expect(planActions(r({ armAction: 'deploy' }), ctx())).toEqual([])
    expect(planActions(r({ armAction: 'deploy' }), ctx({ form: 'spider' }))).toEqual([{ type: 'SPIDER_ARMS_DEPLOY' }])
    expect(planActions(r({ armAction: 'attack' }), ctx({ form: 'spider', armsDeployed: true }))).toEqual([{ type: 'ARMS_MODE', mode: 'ATTACK' }])
  })
})

describe('speech text + variety', () => {
  it('strips markdown, urls, emoji and asterisk actions', () => {
    expect(sanitizeForSpeech('**Hey** *waves* check https://x.io 😀 `code`')).toBe('Hey check code')
  })
  it('never repeats a gesture back to back', () => {
    const g = new VarietyGuard()
    const a = g.apply(sanitizeResponse({ dialogue: 'a', gesture: 'nod' }))
    const b = g.apply(sanitizeResponse({ dialogue: 'b', gesture: 'nod' }))
    expect(a.gesture).toBe('nod'); expect(b.gesture).toBe('none')
  })
})
