import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { director } from './director'
import { cameraBus } from './cameraBus'
import { audio } from '../audio/AudioManager'
import { useCharacterStore } from '../store/characterStore'
import { useSettings, prefersReducedMotion } from '../store/settingsStore'
import { effects } from '../transformation'

/** Shared trigger state for one-shot effects. */
export const fx = {
  sense: -1,              // seconds since spider-sense started (−1 = idle)
  web: -1,                // seconds since web shot started
  webFrom: new THREE.Vector3(),
  webTo: new THREE.Vector3(),
  /** 0..1 multiplier for eye glow flare during spider sense */
  senseFlare: 0,
  /** 0..1 outline pulse strength */
  outline: 0,
  /** debug/QA: freeze effect clocks */
  frozen: false,
}
export const SENSE_DURATION = 0.95
export const WEB_DURATION = 0.95

export function triggerSpiderSense() {
  if (fx.sense >= 0) return
  fx.sense = 0
  audio.spiderSense()
  director.anim?.play('spider_sense')
  director.look.lookAround()
  const st = useCharacterStore.getState()
  st.setSense(true)
  const k = useSettings.getState().cinematicTransform ? (prefersReducedMotion() ? 0.3 : 1) : 0
  cameraBus.kick = 0.06 * k
}

export function triggerWebShoot() {
  if (fx.web >= 0) return
  fx.web = 0
  audio.webShooter()
  director.anim?.play('web_shoot')
  director.setEmotion('confident', 0.7)
  const rig = director.anim?.rig
  if (rig) {
    rig.bones.handR.getWorldPosition(fx.webFrom)
    const head = new THREE.Vector3(); rig.bones.head.getWorldPosition(head)
    fx.webTo.set(head.x - 0.9, head.y + 1.3, head.z + 2.6)
  }
}
effects.onSpiderSense = triggerSpiderSense
effects.onWebShoot = triggerWebShoot

/** Spider-sense ripples + web line. Character outline pulse is driven by fx.outline (see Character). */
export default function SpiderFX() {
  const rings = useRef<THREE.Mesh[]>([])
  const shell = useRef<THREE.Mesh>(null)
  const web = useRef<THREE.Group>(null)
  const line = useRef<THREE.Mesh>(null)
  const dot = useRef<THREE.Mesh>(null)
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.35, 0.3), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [])
  const shellMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.3, 0.3), transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, wireframe: true }), [])
  const webMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2), transparent: true, opacity: 0, toneMapped: false }), [])
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), q: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0) }), [])

  useFrame((_, rawDt) => {
    const dt = fx.frozen ? 0 : rawDt
    // ---- spider sense
    if (fx.sense >= 0) {
      fx.sense += dt
      const p = fx.sense / SENSE_DURATION
      const env = Math.sin(Math.min(1, p) * Math.PI)
      fx.senseFlare = env; fx.outline = Math.abs(Math.sin(p * Math.PI * 3)) * env
      rings.current.forEach((m, i) => {
        if (!m) return
        const pp = Math.max(0, Math.min(1, p * 1.25 - i * 0.16))
        m.scale.setScalar(0.4 + pp * 3.2); m.visible = pp > 0 && pp < 1
        ;(m.material as THREE.MeshBasicMaterial).opacity = (1 - pp) * 0.7 * (pp > 0 ? 1 : 0)
      })
      if (shell.current) {
        shell.current.visible = true
        shell.current.scale.setScalar(0.6 + p * 2.6)
        shellMat.opacity = (1 - p) * 0.35
        shell.current.position.set(0, 1.0, 0)
      }
      if (p >= 1) {
        fx.sense = -1; fx.senseFlare = 0; fx.outline = 0; cameraBus.kick = 0
        useCharacterStore.getState().setSense(false)
        rings.current.forEach((m) => m && (m.visible = false))
        if (shell.current) shell.current.visible = false
      }
    }
    // ---- web shot
    if (fx.web >= 0) {
      fx.web += dt
      const t = fx.web
      const grow = Math.min(1, t / 0.16)
      const fade = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.35)
      if (director.anim) director.anim.rig.bones.handR.getWorldPosition(fx.webFrom)
      const g = web.current, l = line.current
      if (g && l) {
        g.visible = true
        const from = fx.webFrom, to = tmp.a.copy(fx.webTo).sub(from).multiplyScalar(grow).add(from)
        const dir = to.clone().sub(from), len = dir.length()
        l.scale.set(1, Math.max(1e-3, len), 1)
        l.position.copy(from).addScaledVector(dir, 0.5)
        tmp.q.setFromUnitVectors(tmp.up, dir.normalize()); l.quaternion.copy(tmp.q)
        webMat.opacity = fade
        if (dot.current) { dot.current.position.copy(to); dot.current.scale.setScalar(grow > 0.95 ? 1 + Math.min(1, (t - 0.16) * 6) * 0.6 : 0.01); dot.current.visible = grow > 0.95 }
      }
      if (t >= WEB_DURATION) { fx.web = -1; if (web.current) web.current.visible = false }
    }
  })

  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { if (m) rings.current[i] = m }} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} visible={false} material={ringMat.clone()}>
          <ringGeometry args={[0.92, 1, 64]} />
        </mesh>
      ))}
      <mesh ref={shell} visible={false} material={shellMat}><icosahedronGeometry args={[1, 2]} /></mesh>
      <group ref={web} visible={false}>
        <mesh ref={line} material={webMat}><cylinderGeometry args={[0.006, 0.006, 1, 6]} /></mesh>
        <mesh ref={dot} material={webMat}><icosahedronGeometry args={[0.05, 1]} /></mesh>
      </group>
    </group>
  )
}
