import type { Emotion } from '../ai/schema'

export interface VoiceParams { pitch: number; rate: number; volume: number }

/** Young, energetic synthetic hero-style preset; emotion & hero form modulate it (spec §23). */
const BASE: VoiceParams = { pitch: 1.12, rate: 1.05, volume: 1 }
const DELTA: Record<Emotion, VoiceParams> = {
  neutral: { pitch: 0, rate: 0, volume: 0 },
  happy: { pitch: 0.08, rate: 0.05, volume: 0 },
  excited: { pitch: 0.16, rate: 0.13, volume: 0 },
  curious: { pitch: 0.1, rate: 0, volume: 0 },
  thinking: { pitch: -0.04, rate: -0.1, volume: -0.05 },
  embarrassed: { pitch: 0.08, rate: 0.06, volume: -0.15 },
  worried: { pitch: 0.02, rate: 0.02, volume: -0.05 },
  sad: { pitch: -0.15, rate: -0.15, volume: -0.2 },
  serious: { pitch: -0.14, rate: -0.07, volume: 0.02 },
  surprised: { pitch: 0.2, rate: 0.1, volume: 0.05 },
  confident: { pitch: -0.03, rate: 0.03, volume: 0.03 },
  focused: { pitch: -0.06, rate: 0.02, volume: 0 },
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function voiceParams(emotion: Emotion, intensity: number, spider: boolean, userRate = 1.05): VoiceParams {
  const d = DELTA[emotion], k = clamp(intensity, 0, 1)
  return {
    pitch: clamp(BASE.pitch + d.pitch * k - (spider ? 0.04 : 0), 0.5, 2),
    rate: clamp(userRate + d.rate * k + (spider ? 0.04 : 0), 0.6, 1.6),
    volume: clamp(BASE.volume + d.volume * k, 0.2, 1),
  }
}

/** Split into sentence-sized chunks (Chrome truncates long utterances) keeping character offsets. */
export function chunkText(text: string, max = 180): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = []
  const re = /[^.!?。！？…\n]+[.!?。！？…]*\s*/g
  let m: RegExpExecArray | null
  let cur = '', curOff = 0
  while ((m = re.exec(text))) {
    if (!cur) curOff = m.index
    if ((cur + m[0]).length > max && cur) { out.push({ text: cur, offset: curOff }); cur = m[0]; curOff = m.index } else cur += m[0]
  }
  if (cur) out.push({ text: cur, offset: curOff })
  return out.length ? out : [{ text, offset: 0 }]
}

export const detectLang = (text: string, fallback = 'en-US') => (/[가-힣]/.test(text) ? 'ko-KR' : /[ぁ-んァ-ン]/.test(text) ? 'ja-JP' : /[一-鿿]/.test(text) ? 'zh-CN' : fallback)
