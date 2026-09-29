import { NanotechController, type Command } from './NanotechController'
import { useCharacterStore } from '../store/characterStore'
import { setWorld } from '../ai/executor'
import type { ActionCommand } from '../ai/actions'
import { director } from '../character/director'

/** The one transformation controller for the app. */
export const nano = new NanotechController()

let lastPublish = 0
export function publishSuitStatus(force = false) {
  const now = performance.now()
  if (!force && now - lastPublish < 90) return
  lastPublish = now
  const prev = useCharacterStore.getState().suit
  const next = {
    form: nano.form, phase: nano.phase, mask: nano.mask, arms: nano.arms, armsMode: nano.armsMode,
    blend: Math.round(nano.formBlend * 100) / 100, label: nano.label(director.talking),
  }
  if (prev.form !== next.form || prev.phase !== next.phase || prev.mask !== next.mask || prev.arms !== next.arms || prev.armsMode !== next.armsMode || prev.blend !== next.blend || prev.label !== next.label)
    useCharacterStore.getState().setSuit(next)
}
nano.onAny(() => publishSuitStatus(true))

/** UI / hotkey entry point. */
export function command(cmd: Command) {
  const r = nano.dispatch(cmd)
  publishSuitStatus(true)
  return r
}

const map = (c: ActionCommand): Command | null => {
  switch (c.type) {
    case 'SUIT_UP': return 'SUIT_UP'
    case 'SUIT_DOWN': return 'SUIT_DOWN'
    case 'MASK_OPEN': return 'MASK_OPEN'
    case 'MASK_CLOSE': return 'MASK_CLOSE'
    case 'SPIDER_ARMS_DEPLOY': return 'ARMS_DEPLOY'
    case 'SPIDER_ARMS_RETRACT': return 'ARMS_RETRACT'
    default: return null
  }
}

/** Let the AI act on the world (validated by planActions first). */
export const effects = { lastEffectAt: 0, onWebShoot: null as null | (() => void), onSpiderSense: null as null | (() => void) }
setWorld({
  context: () => ({
    form: nano.form === 'SPIDER' ? 'spider' : 'peter',
    transforming: nano.transforming,
    maskOpen: nano.maskOpen,
    armsDeployed: nano.armsDeployed,
    lastTransformAt: nano.lastTransformAt,
    lastEffectAt: effects.lastEffectAt,
  }),
  run: (cmds) => {
    for (const c of cmds) {
      if (c.type === 'WEB_SHOOT') { effects.lastEffectAt = Date.now(); effects.onWebShoot?.(); continue }
      if (c.type === 'SPIDER_SENSE') { effects.lastEffectAt = Date.now(); effects.onSpiderSense?.(); continue }
      if (c.type === 'ARMS_MODE') { nano.setArmsMode(c.mode); continue }
      const m = map(c)
      if (m) command(m)
    }
  },
})
