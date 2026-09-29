import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { useQuality, FpsGovernor, detectQuality } from '../quality/quality'
import { useSettings } from '../store/settingsStore'

const governor = new FpsGovernor(3)

/** Quality-aware post-processing (bloom for nano glow) + device detection + FPS governor. */
export default function Effects() {
  const { gl } = useThree()
  const cfg = useQuality((s) => s.config)
  const bloomOn = useSettings((s) => s.bloom)
  const bloom = cfg.bloom && bloomOn

  useEffect(() => { detectQuality(gl.getContext()) }, [gl])
  useEffect(() => {
    gl.toneMapping = bloom ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
    gl.shadowMap.enabled = true
  }, [gl, bloom])
  useEffect(() => { gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.dprMax)) }, [gl, cfg.dprMax])
  useFrame((_, dt) => governor.tick(dt))

  if (!bloom) return null
  return (
    <EffectComposer multisampling={cfg.msaa} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.92} luminanceSmoothing={0.25} radius={0.75} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
