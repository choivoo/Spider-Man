import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Character from '../character/Character'
import Room from './Room'
import CameraRig from './CameraRig'
import Effects from './Effects'
import Boot from './Boot'
import SpiderFX from '../character/SpiderFX'

export default function Stage() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.25, 4.6], fov: 30, near: 0.05, far: 60 }}
      dpr={[1, 2]} flat
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl, scene }) => { const w = window as unknown as { __spider?: Record<string, unknown> }; if (w.__spider) { w.__spider.gl = gl; w.__spider.scene = scene } }}
    >
      <Room />
      <Boot />
      <Character />
      <SpiderFX />
      <CameraRig />
      <Effects />
    </Canvas>
  )
}
