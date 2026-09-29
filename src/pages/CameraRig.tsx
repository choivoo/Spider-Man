import { useEffect, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitImpl } from 'three-stdlib'
import { useCharacterStore, type CameraMode } from '../store/characterStore'

const PRESETS: Record<CameraMode, { target: [number, number, number]; dist: number; azim: number; polar: number; fov: number }> = {
  face: { target: [0, 1.6, 0], dist: 1.05, azim: 0.05, polar: 1.5, fov: 28 },
  upper: { target: [0, 1.32, 0], dist: 2.3, azim: 0, polar: 1.5, fov: 30 },
  full: { target: [0, 0.98, 0], dist: 4.7, azim: 0, polar: 1.48, fov: 30 },
  cinematic: { target: [0, 1.05, 0], dist: 3.3, azim: 0.5, polar: 1.36, fov: 26 },
}

/** Orbit camera with tweened presets; a soft additive "kick" (zoom) is layered on top for cinematic moments. */
export default function CameraRig() {
  const ctl = useRef<OrbitImpl>(null)
  const mode = useCharacterStore((s) => s.cameraMode)
  const { camera } = useThree()
  const tween = useRef<{ t: number; from: THREE.Vector3; fromT: THREE.Vector3; to: THREE.Vector3; toT: THREE.Vector3; fov0: number; fov1: number } | null>(null)
  const kick = useRef(0)
  const lastKick = useRef(0)
  const kickTarget = useRef(0)
  const first = useRef(true)

  useEffect(() => {
    const c = ctl.current
    if (!c) return
    const p = PRESETS[mode]
    const target = new THREE.Vector3(...p.target)
    const sph = new THREE.Spherical(p.dist, p.polar, p.azim)
    const to = new THREE.Vector3().setFromSpherical(sph).add(target)
    if (first.current) {
      first.current = false
      camera.position.copy(to); c.target.copy(target); c.update()
      ;(camera as THREE.PerspectiveCamera).fov = p.fov; camera.updateProjectionMatrix()
      return
    }
    tween.current = { t: 0, from: camera.position.clone(), fromT: c.target.clone(), to, toT: target, fov0: (camera as THREE.PerspectiveCamera).fov, fov1: p.fov }
  }, [mode, camera])

  useEffect(() => {
    ;(window as unknown as { __cameraKick?: (k: number) => void }).__cameraKick = (k: number) => { kickTarget.current = k }
    return () => { delete (window as unknown as { __cameraKick?: unknown }).__cameraKick }
  }, [])

  useFrame((_, dt) => {
    const c = ctl.current
    if (!c) return
    const tw = tween.current
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / 0.9)
      const e = tw.t * tw.t * (3 - 2 * tw.t)
      camera.position.lerpVectors(tw.from, tw.to, e)
      c.target.lerpVectors(tw.fromT, tw.toT, e)
      const cam = camera as THREE.PerspectiveCamera
      cam.fov = THREE.MathUtils.lerp(tw.fov0, tw.fov1, e); cam.updateProjectionMatrix()
      if (tw.t >= 1) tween.current = null
    }
    // additive zoom kick (dolly toward target)
    kick.current += (kickTarget.current - kick.current) * (1 - Math.exp(-dt * 5))
    const dk = kick.current - lastKick.current
    if (Math.abs(dk) > 1e-5) {
      const off = camera.position.clone().sub(c.target)
      off.multiplyScalar((1 - kick.current) / (1 - lastKick.current))
      camera.position.copy(c.target).add(off)
      lastKick.current = kick.current
    }
    c.update()
  })

  return (
    <OrbitControls
      ref={ctl as never}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={0.7}
      maxDistance={8}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI * 0.53}
      onStart={() => { tween.current = null }}
    />
  )
}
