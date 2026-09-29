import * as THREE from 'three'
import type { Rig } from '../character/ProceduralRig'
import { twoBoneIK, smoothVec, clawBasis } from './SpiderArmIK'
import { goalsFor, FOLD, SOCKETS, type ArmGoal } from './armPoses'
import type { ArmsMode } from '../transformation/NanotechController'
import { smooth01, window01 } from '../transformation/timeline'

export const L1 = 0.5, L2 = 0.46, L3 = 0.2

const GOLD = () => new THREE.MeshPhysicalMaterial({ color: '#b99545', metalness: 0.95, roughness: 0.28, clearcoat: 0.25, envMapIntensity: 1.4 })
const DARK = () => new THREE.MeshStandardMaterial({ color: '#0d1016', metalness: 0.6, roughness: 0.38 })
const LED = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.7, 2.4), toneMapped: false })

/** Tapered tube along a bezier (the curved claw blade). */
function clawGeometry(radial: number, len = L3): THREE.BufferGeometry {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, len * 0.55, 0.02), new THREE.Vector3(0, len * 0.9, len * 0.5))
  const seg = 14
  const g = new THREE.TubeGeometry(curve, seg, 0.02, radial, false)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const ringVerts = radial + 1
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / ringVerts)
    const t = ring / seg
    const c = curve.getPointAt(t)
    const k = Math.max(0.04, 1 - t * 0.98)
    const x = pos.getX(i) - c.x, y = pos.getY(i) - c.y, z = pos.getZ(i) - c.z
    pos.setXYZ(i, c.x + x * k, c.y + y * k, c.z + z * k)
  }
  g.computeVertexNormals()
  return g
}

interface SegmentGroup { group: THREE.Group; length: number }

function makeSegment(len: number, r0: number, r1: number, radial: number, gold: THREE.Material, dark: THREE.Material, led: THREE.Material): SegmentGroup {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, radial, 1), gold)
  body.position.y = len / 2
  // black inset sleeve + cyan strip
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(r1 * 1.12, r0 * 1.12, len * 0.5, radial, 1), dark)
  sleeve.position.y = len * 0.5
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.004, len * 0.62, 0.004), led)
  strip.position.set(0, len * 0.5, (r0 + r1) * 0.6)
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(r0 * 1.2, r0 * 0.22, 6, radial * 2), gold)
  ring1.rotation.x = Math.PI / 2; ring1.position.y = len * 0.1
  const ring2 = ring1.clone(); ring2.position.y = len * 0.9
  sleeve.userData.detail = strip.userData.detail = ring1.userData.detail = ring2.userData.detail = true
  g.add(body, sleeve, strip, ring1, ring2)
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true })
  return { group: g, length: len }
}

class Arm {
  root = new THREE.Group()
  seg1: SegmentGroup
  seg2: SegmentGroup
  claw: THREE.Mesh
  joints: THREE.Mesh[] = []
  // smoothed goal
  wrist = new THREE.Vector3()
  clawDir = new THREE.Vector3(0, -1, 0)
  curl = new THREE.Vector3(0, 0, 1)
  pole = new THREE.Vector3(0, 1, 0)
  private ik = { elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), reach: 0, clamped: false }
  private q = new THREE.Quaternion()
  private up = new THREE.Vector3(0, 1, 0)
  private tmpV = new THREE.Vector3()

  constructor(public index: number, public isTop: boolean, public sx: 1 | -1, radial: number, mats: { gold: THREE.Material; dark: THREE.Material; led: THREE.Material }) {
    this.seg1 = makeSegment(L1, 0.026, 0.02, radial, mats.gold, mats.dark, mats.led)
    this.seg2 = makeSegment(L2, 0.02, 0.015, radial, mats.gold, mats.dark, mats.led)
    this.claw = new THREE.Mesh(clawGeometry(Math.max(5, radial - 2)), mats.gold)
    this.claw.castShadow = true
    for (let i = 0; i < 3; i++) { const j = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.034 : 0.026, radial, Math.max(6, radial / 2)), mats.dark); this.joints.push(j); this.root.add(j) }
    this.root.add(this.seg1.group, this.seg2.group, this.claw)
    this.root.visible = false
  }

  setGoal(g: ArmGoal, dt: number, sway: THREE.Vector3) {
    const tw = this.tmpV.copy(g.wrist).add(sway)
    if (this.wrist.lengthSq() === 0) { this.wrist.copy(tw); this.clawDir.copy(g.claw).normalize(); this.curl.copy(g.curl); this.pole.copy(g.pole) }
    smoothVec(this.wrist, tw, dt, 7)
    smoothVec(this.clawDir, g.claw, dt, 7)
    smoothVec(this.curl, g.curl, dt, 7)
    smoothVec(this.pole, g.pole, dt, 7)
  }

  /** stage progress values (0..1) */
  pose(base: THREE.Vector3, cover: number, s1: number, s2: number, sc: number, emerge: number) {
    this.root.visible = cover > 0.02
    if (!this.root.visible) return
    const B = base.clone()
    B.z += 0.045 * (1 - smooth01(cover)) // rises out of the plate
    const ik = twoBoneIK(B, L1, L2, this.wrist, this.pole, this.ik)
    const fold = this.isTop ? FOLD.top : FOLD.bottom
    const d1t = ik.elbow.clone().sub(B).normalize()
    const d2t = ik.wrist.clone().sub(ik.elbow).normalize()
    const d3t = this.clawDir.clone().normalize()
    const d1 = fold[0].clone().normalize().lerp(d1t, s1).normalize()
    const d2 = fold[1].clone().normalize().lerp(d2t, s2).normalize()
    const d3 = fold[2].clone().normalize().lerp(d3t, sc).normalize()
    const E = B.clone().addScaledVector(d1, L1)
    const W = E.clone().addScaledVector(d2, L2)
    const place = (g: THREE.Object3D, p: THREE.Vector3, dir: THREE.Vector3) => { g.position.copy(p); g.quaternion.setFromUnitVectors(this.up, dir) }
    place(this.seg1.group, B, d1); place(this.seg2.group, E, d2)
    clawBasis(d3, this.curl, this.q); this.claw.position.copy(W); this.claw.quaternion.copy(this.q)
    this.joints[0].position.copy(B); this.joints[1].position.copy(E); this.joints[2].position.copy(W)
    // emerge scale about the socket (telescopes in/out of the plate at the ends of the motion)
    this.root.scale.setScalar(Math.max(0.001, emerge))
    this.root.position.copy(B).multiplyScalar(1 - emerge)
  }

  /** claw tip in chest space */
  tip(out: THREE.Vector3) { return out.copy(this.claw.position).add(new THREE.Vector3(0, L3 * 0.9, L3 * 0.5).applyQuaternion(this.claw.quaternion)) }
}

/** Four mechanical spider arms (spec §11): deploy sequence, five pose modes, IK reach, idle sway. */
export class SpiderArms {
  group = new THREE.Group()
  private arms: Arm[] = []
  private hatches: THREE.Mesh[] = []
  private time = 0
  mode: ArmsMode = 'IDLE'
  private mats = { gold: GOLD(), dark: DARK(), led: LED() }

  constructor(private rig: Rig, radial = 12) {
    this.group.name = 'SpiderArms'
    const spec: [boolean, 1 | -1][] = [[true, 1], [true, -1], [false, 1], [false, -1]]
    spec.forEach(([top, sx], i) => {
      const a = new Arm(i, top, sx, radial, this.mats)
      this.arms.push(a); this.group.add(a.root)
    })
    // hatches over the sockets that swing open first
    SOCKETS.forEach((s, i) => {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16), this.mats.dark)
      h.rotation.x = Math.PI / 2; h.position.copy(s).add(new THREE.Vector3(0, 0, -0.01))
      h.userData.i = i; this.hatches.push(h); this.group.add(h)
    })
    rig.bones.chest.add(this.group)
    this.group.position.set(0, 0, 0)
    this.group.visible = false
  }

  get armMeshes() { return this.arms }

  setMode(m: ArmsMode) { this.mode = m }

  /** progress 0..1 from the controller; returns nothing — mutates the scene graph */
  update(dt: number, progress: number, sense = 0) {
    dt = Math.min(dt, 0.05)
    this.time += dt
    this.group.visible = progress > 0.001
    if (!this.group.visible) return
    const goals = goalsFor(this.mode === 'IDLE' ? 'IDLE' : this.mode)
    const t = this.time
    const cover = window01(progress, [0.0, 0.2])
    this.hatches.forEach((h, i) => {
      const open = smooth01(cover) // hatches slide sideways off the socket
      h.position.x = SOCKETS[i].x + (i % 2 === 0 ? 1 : -1) * open * 0.04
      h.visible = progress < 0.999
      h.scale.setScalar(1 - open * 0.3)
    })
    this.arms.forEach((arm, i) => {
      const stagger = i * 0.035
      const p = Math.min(1, Math.max(0, progress - stagger) / (1 - 0.105))
      // idle sway (alive), stronger for top arms; more agitated during spider sense
      const sway = new THREE.Vector3(Math.sin(t * 0.9 + i * 1.7) * 0.025, Math.sin(t * 1.3 + i) * 0.03, Math.cos(t * 0.8 + i * 2.1) * 0.025).multiplyScalar(1 + sense * 3)
      arm.setGoal(goals[i], dt, sway)
      const emerge = window01(p, [0.0, 0.12])
      const armCover = window01(p, [0.04, 0.28])
      const s1 = window01(p, [0.2, 0.55]), s2 = window01(p, [0.4, 0.78]), sc = window01(p, [0.62, 1])
      arm.pose(SOCKETS[i], Math.max(armCover, emerge), s1, s2, sc, emerge)
    })
  }

  /** LOD2 drops the decorative rings / sleeves / LED strips (they are sub-pixel at that distance). */
  setLOD(level: number) {
    this.group.traverse((o) => { if (o.userData.detail) o.visible = level < 2 })
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.geometry.dispose() }
    })
    Object.values(this.mats).forEach((m) => m.dispose())
    this.group.removeFromParent()
  }
}
