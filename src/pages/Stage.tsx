import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Character from '../character/Character'
import Room from './Room'
import CameraRig from './CameraRig'
import Effects from './Effects'
import SpiderFX from '../character/SpiderFX'

export default function Stage() {
  return (
    <Canvas
      shadows="soft"
      camera={{ position: [0, 1.25, 4.6], fov: 30, near: 0.05, far: 60 }}
      dpr={[1, 2]} flat
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <Room />
      <Character />
      <SpiderFX />
      <CameraRig />
      <Effects />
    </Canvas>
  )
}
