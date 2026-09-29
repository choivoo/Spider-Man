import type { CharacterResponse } from './schema'

export type ActionCommand =
  | { type: 'SUIT_UP' } | { type: 'SUIT_DOWN' }
  | { type: 'MASK_OPEN' } | { type: 'MASK_CLOSE' }
  | { type: 'SPIDER_ARMS_DEPLOY' } | { type: 'SPIDER_ARMS_RETRACT' }
  | { type: 'ARMS_MODE'; mode: 'DEFENSE' | 'ATTACK' | 'BALANCE' | 'POSE' }
  | { type: 'WEB_SHOOT' } | { type: 'SPIDER_SENSE' }

export interface ActionContext {
  form: 'peter' | 'spider'
  transforming: boolean
  maskOpen: boolean
  armsDeployed: boolean
  allowActions: boolean
  now: number
  lastTransformAt: number
  lastEffectAt: number
}

export const AI_TRANSFORM_COOLDOWN_MS = 25_000
export const AI_EFFECT_COOLDOWN_MS = 12_000

/**
 * Validates AI-requested actions. The model asks; the client decides. Prevents over-transforming,
 * impossible states (mask in civilian form) and action spam.
 */
export function planActions(r: CharacterResponse, c: ActionContext): ActionCommand[] {
  if (!c.allowActions || c.transforming) return []
  const out: ActionCommand[] = []
  const transformOk = c.now - c.lastTransformAt > AI_TRANSFORM_COOLDOWN_MS
  switch (r.suitAction) {
    case 'suit_up': if (c.form === 'peter' && transformOk) out.push({ type: 'SUIT_UP' }); break
    case 'suit_down': if (c.form === 'spider' && transformOk) out.push({ type: 'SUIT_DOWN' }); break
    case 'mask_open': if (c.form === 'spider' && !c.maskOpen) out.push({ type: 'MASK_OPEN' }); break
    case 'mask_close': if (c.form === 'spider' && c.maskOpen) out.push({ type: 'MASK_CLOSE' }); break
    case 'web_shoot': if (c.form === 'spider' && c.now - c.lastEffectAt > AI_EFFECT_COOLDOWN_MS) out.push({ type: 'WEB_SHOOT' }); break
    case 'spider_sense': if (c.now - c.lastEffectAt > AI_EFFECT_COOLDOWN_MS) out.push({ type: 'SPIDER_SENSE' }); break
    default: break
  }
  if (c.form === 'spider' || out.some((o) => o.type === 'SUIT_UP')) {
    switch (r.armAction) {
      case 'deploy': if (!c.armsDeployed && c.form === 'spider') out.push({ type: 'SPIDER_ARMS_DEPLOY' }); break
      case 'retract': if (c.armsDeployed) out.push({ type: 'SPIDER_ARMS_RETRACT' }); break
      case 'defense': case 'attack': case 'balance': case 'pose':
        if (c.armsDeployed) out.push({ type: 'ARMS_MODE', mode: r.armAction.toUpperCase() as 'DEFENSE' })
        break
      default: break
    }
  }
  return out
}
