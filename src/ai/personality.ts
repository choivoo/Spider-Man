import type { CharacterResponse, Gesture } from './schema'

/** Strip markdown / emoji / stage directions so text is safe to speak and subtitle. */
export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*[^*\n]{1,40}\*/g, '')
    .replace(/\*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/^[-#>\s]+/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Keeps the character from repeating itself: same gesture twice in a row, or a reply starting identically. */
export class VarietyGuard {
  private lastGesture: Gesture = 'none'
  private openings: string[] = []
  apply(r: CharacterResponse): CharacterResponse {
    const out = { ...r }
    if (out.gesture !== 'none' && out.gesture === this.lastGesture) out.gesture = 'none'
    if (out.gesture !== 'none') this.lastGesture = out.gesture
    else if (Math.random() < 0.5) this.lastGesture = 'none'
    const open = out.dialogue.slice(0, 6)
    this.openings.push(open)
    if (this.openings.length > 4) this.openings.shift()
    return out
  }
  get recentOpenings() { return [...this.openings] }
}
