import * as THREE from 'three'
import { HEAD } from './profiles'
import { profileAt } from './loft'
import type { EyeExpression } from '../ai/schema'

/** Mask lenses as deformable meshes (spec §12): shape follows the expression, blink and gaze. */
const PTS: [number, number][] = [
  [-1.0, -0.1], [-0.5, -0.85], [0.4, -0.85], [1.0, 0.15], [0.55, 0.8], [-0.1, 0.72], [-0.86, 0.5],
]

interface Shape { open: number; angry: number; happy: number; width: number; tilt: number }
const SHAPES: Record<EyeExpression, Shape> = {
  normal: { open: 1, angry: 0, happy: 0, width: 1, tilt: 0 },
  happy: { open: 0.85, angry: 0, happy: 1, width: 1, tilt: 0 },
  confused: { open: 1.1, angry: 0, happy: 0, width: 0.95, tilt: 0.1 },
  angry: { open: 0.75, angry: 1, happy: 0, width: 1.05, tilt: 0 },
  surprised: { open: 1.5, angry: 0, happy: 0, width: 0.9, tilt: 0 },
  focused: { open: 0.62, angry: 0.3, happy: 0, width: 1.08, tilt: 0 },
}

const CX = 0.0365, CY = 0.055, W = 0.062, H = 0.03

class Lens {
  fill: THREE.Mesh
  edge: THREE.Mesh
  cur: Shape = { ...SHAPES.normal }
  constructor(public side: 1 | -1, fillMat: THREE.Material, edgeMat: THREE.Material) {
    const mkGeo = () => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((PTS.length + 1) * 3), 3))
      const idx: number[] = []
      for (let i = 0; i < PTS.length; i++) idx.push(PTS.length, i, (i + 1) % PTS.length)
      g.setIndex(idx)
      return g
    }
    this.fill = new THREE.Mesh(mkGeo(), fillMat); this.edge = new THREE.Mesh(mkGeo(), edgeMat)
    this.fill.frustumCulled = this.edge.frustumCulled = false
    this.fill.renderOrder = 3; this.edge.renderOrder = 2
  }
  private write(mesh: THREE.Mesh, s: Shape, blink: number, gx: number, gy: number, grow: number, lift: number) {
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const open = s.open * Math.max(0.02, 1 - blink)
    for (let i = 0; i <= PTS.length; i++) {
      const [nx0, ny0] = i < PTS.length ? PTS[i] : [0, 0]
      const inner = Math.min(1, Math.max(0, (1 - nx0) / 2))
      let ny = ny0
      if (ny0 > 0) ny -= s.angry * 0.7 * inner + s.happy * 0.0
      if (ny0 < 0) ny += s.happy * (0.95 - Math.abs(nx0) * 0.3)
      ny = ny * open + s.tilt * (nx0) * 0.3
      const x = this.side * (CX + gx * 0.004) + this.side * nx0 * (W / 2) * s.width * grow * (this.side === 1 ? 1 : 1)
      // for the left eye (+x side) inner end is at −nx, for the right eye mirrored
      const xx = this.side === 1 ? CX + gx * 0.004 + nx0 * (W / 2) * s.width * grow : -(CX - gx * 0.004) - nx0 * (W / 2) * s.width * grow
      void x
      const y = CY + gy * 0.003 + ny * (H / 2) * grow + lift
      const sec = profileAt(HEAD, y)
      const rel = Math.min(0.98, Math.abs(xx) / Math.max(1e-4, sec.rx))
      const z = sec.cz + sec.rz * Math.pow(Math.max(0, 1 - Math.pow(rel, sec.n)), 1 / sec.n)
      pos.setXYZ(i, xx, y, z + 0.0062 + (grow > 1 ? 0 : 0.0012))
    }
    pos.needsUpdate = true
  }
  update(target: Shape, blink: number, gx: number, gy: number, dt: number) {
    const k = 1 - Math.exp(-dt * 14)
    for (const key of Object.keys(target) as (keyof Shape)[]) this.cur[key] += (target[key] - this.cur[key]) * k
    this.write(this.edge, this.cur, blink, gx, gy, 1.16, 0)
    this.write(this.fill, this.cur, blink, gx, gy, 1.0, 0)
  }
}

export class SpiderEyes {
  group = new THREE.Group()
  private L: Lens
  private R: Lens
  private fillMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.35, 1.45), toneMapped: false, transparent: true, side: THREE.DoubleSide })
  private edgeMat = new THREE.MeshBasicMaterial({ color: '#030405', transparent: true, side: THREE.DoubleSide })
  glow = 0
  constructor() {
    this.L = new Lens(1, this.fillMat, this.edgeMat)
    this.R = new Lens(-1, this.fillMat, this.edgeMat)
    this.group.add(this.L.edge, this.R.edge, this.L.fill, this.R.fill)
    this.group.visible = false
  }
  /** `glow` 0..1 controls light-up; `blink` 0..1; gaze in radians (small shifts of the lens) */
  update(expr: EyeExpression, blink: number, gazeYaw: number, gazePitch: number, glow: number, dt: number, asym = 0) {
    this.glow = glow
    this.group.visible = glow > 0.02
    if (!this.group.visible) return
    const t = SHAPES[expr]
    const tl: Shape = { ...t, open: t.open * (1 + asym * 0.15) }
    const tr: Shape = { ...t, open: t.open * (1 - asym * 0.25), tilt: -t.tilt }
    this.L.update(tl, blink, gazeYaw * 2, gazePitch * 2, dt)
    this.R.update(tr, blink, gazeYaw * 2, gazePitch * 2, dt)
    this.fillMat.opacity = Math.min(1, glow * 1.2)
    this.edgeMat.opacity = Math.min(1, glow * 1.5)
    const b = 1 + glow * 0.4
    this.fillMat.color.setRGB(1.25 * b, 1.35 * b, 1.45 * b)
  }
  dispose() { for (const m of [this.L, this.R]) { m.fill.geometry.dispose(); m.edge.geometry.dispose() } this.fillMat.dispose(); this.edgeMat.dispose() }
}
