import { useEffect } from 'react'
import { useSettings, prefersReducedMotion } from '../store/settingsStore'
import { director } from '../character/director'
import { useCharacterStore } from '../store/characterStore'
import { voice } from '../audio/VoiceManager'
import { audio } from '../audio/AudioManager'

/** Applies settings side-effects that live outside React state (motion, text size, camera, volume). */
export function useSettingsEffects() {
  const reduced = useSettings((s) => s.reducedMotion)
  const textSize = useSettings((s) => s.textSize)
  const muted = useSettings((s) => s.muted)
  useEffect(() => {
    const apply = () => { const r = prefersReducedMotion(); director.setReducedMotion(r); document.documentElement.classList.toggle('reduced-motion', r) }
    apply()
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [reduced])
  useEffect(() => { document.documentElement.dataset.textSize = textSize }, [textSize])
  useEffect(() => { if (muted) voice.stop(); audio.applyVolume() }, [muted])
  useEffect(() => { useCharacterStore.getState().setCameraMode(useSettings.getState().defaultCamera) }, [])
}
