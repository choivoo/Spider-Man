import { nano } from './index'
import { cameraBus } from '../character/cameraBus'
import { audio } from '../audio/AudioManager'
import { useSettings, prefersReducedMotion } from '../store/settingsStore'

/** Wires transformation events to soft cinematic camera moves and sound. */
export function initCinematic() {
  const amp = () => (useSettings.getState().cinematicTransform ? (prefersReducedMotion() ? 0.35 : 1) : 0)
  nano.on('suitUpStart', () => { cameraBus.kick = 0.05 * amp(); audio.nanoMovement(2.1) })
  nano.on('core', () => audio.nanoActivation())
  nano.on('maskForm', () => { cameraBus.focus = 1 * amp() })
  nano.on('maskClose', () => audio.maskClose())
  nano.on('suitUpComplete', () => { cameraBus.kick = 0; cameraBus.focus = 0; audio.suitComplete() })
  nano.on('suitDownStart', () => { cameraBus.kick = 0.04 * amp(); audio.maskOpen(); audio.nanoMovement(2.0) })
  nano.on('suitDownComplete', () => { cameraBus.kick = 0; cameraBus.focus = 0; audio.suitDownComplete() })
  nano.on('maskCloseStart', () => { cameraBus.focus = 0.7 * amp(); audio.maskClose() })
  nano.on('maskCloseDone', () => { cameraBus.focus = 0 })
  nano.on('maskOpenStart', () => { cameraBus.focus = 0.7 * amp(); audio.maskOpen() })
  nano.on('maskOpenDone', () => { cameraBus.focus = 0 })
  nano.on('armsDeployStart', () => audio.armsDeploy())
  nano.on('armsRetractStart', () => audio.armsRetract())
}
