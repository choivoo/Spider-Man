import { describe, it, expect } from 'vitest'
import { buildTimeline, estimateDuration, LipSyncPlayer } from '../src/animation/LipSync'
import { sampleGesture } from '../src/animation/pose'
import { GESTURES } from '../src/animation/poses'
import { FaceController } from '../src/animation/FaceController'

describe('lip sync', () => {
  it('maps Korean vowels to visemes and ends at the requested duration', () => {
    const tl = buildTimeline('안녕하세요', 2)
    expect(tl.some((e) => e.viseme === 'AA')).toBe(true)
    const end = tl[tl.length - 1].t + tl[tl.length - 1].dur
    expect(end).toBeCloseTo(2, 5)
  })
  it('maps English graphemes', () => {
    const v = buildTimeline('Hello, boop').map((e) => e.viseme)
    expect(v).toContain('EE'); expect(v).toContain('OH'); expect(v).toContain('M'); expect(v).toContain('REST')
  })
  it('player finishes', () => {
    const p = new LipSyncPlayer(); p.start('hi there', 1)
    let n = 0; while (p.playing && n++ < 200) p.tick(0.05)
    expect(p.playing).toBe(false)
  })
  it('estimates longer text as longer', () => {
    expect(estimateDuration('안녕하세요 오늘은 날씨가 정말 좋네요')).toBeGreaterThan(estimateDuration('안녕'))
  })
})

describe('gestures', () => {
  it('fade in/out: weights start and end at 0', () => {
    for (const [name, g] of Object.entries(GESTURES)) {
      const a = sampleGesture(g, 0), b = sampleGesture(g, g.duration)
      for (const e of [...Object.values(a), ...Object.values(b)]) expect(e!.w, name).toBeCloseTo(0, 5)
    }
  })
})

describe('face controller', () => {
  it('converges to the emotion target and blinks', () => {
    const f = new FaceController(); f.setEmotion('happy', 1)
    let blinked = false
    for (let i = 0; i < 600; i++) { f.update(1 / 60, { talking: false }); if (f.state.Blink_L > 0.5) blinked = true }
    expect(f.state.Smile_L).toBeGreaterThan(0.6)
    expect(blinked).toBe(true)
  })
})

import { voiceParams, chunkText, detectLang } from '../src/audio/emotionVoice'
describe('emotion voice', () => {
  it('modulates pitch/rate by emotion and hero form', () => {
    const calm = voiceParams('neutral', 0.5, false), excited = voiceParams('excited', 1, false), sad = voiceParams('sad', 1, false), hero = voiceParams('neutral', 0.5, true)
    expect(excited.pitch).toBeGreaterThan(calm.pitch); expect(excited.rate).toBeGreaterThan(calm.rate)
    expect(sad.pitch).toBeLessThan(calm.pitch); expect(sad.volume).toBeLessThan(calm.volume)
    expect(hero.rate).toBeGreaterThan(calm.rate)
    for (const p of [calm, excited, sad, hero]) { expect(p.pitch).toBeGreaterThan(0.5); expect(p.rate).toBeLessThanOrEqual(1.6) }
  })
  it('chunks long text on sentence boundaries with offsets', () => {
    const t = '첫 번째 문장입니다. 두 번째 문장이에요! 세 번째는 조금 더 긴 문장이라서 잘릴 수도 있어요? 네.'
    const c = chunkText(t, 30)
    expect(c.map((x) => x.text).join('')).toBe(t)
    for (const ch of c) expect(t.slice(ch.offset, ch.offset + ch.text.length)).toBe(ch.text)
  })
  it('detects language', () => { expect(detectLang('안녕')).toBe('ko-KR'); expect(detectLang('hello')).toBe('en-US') })
})
