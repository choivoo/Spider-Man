import * as THREE from 'three'
import vert from '../shaders/nano.vert?raw'
import frag from '../shaders/nano.frag?raw'
import { SUIT_PARTS, SUIT_PART_BONE, type SuitPartName } from '../character/rigSpec'
import type { Rig } from '../character/ProceduralRig'

type Seg = { a: [number, number, number]; b: [number, number, number]; r: number; angle?: [number, number] }
const V = (x: number, y: number, z: number): [number, number, number] => [x, y, z]

/** Capsule (bone-local) each suit region's particles settle on. */
const SEGS: Record<SuitPartName, Seg> = {
  Head: { a: V(0, 0.02, 0.01), b: V(0, 0.13, 0.0), r: 0.088 },
  Neck: { a: V(0, 0, 0), b: V(0, 0.13, 0), r: 0.052 },
  Chest: { a: V(0, -0.02, 0), b: V(0, 0.24, 0), r: 0.155, angle: [Math.PI + 0.35, Math.PI * 2 - 0.35] },
  Back: { a: V(0, -0.02, 0), b: V(0, 0.24, 0), r: 0.14, angle: [0.35, Math.PI - 0.35] },
  Shoulder_L: { a: V(0.02, 0, 0), b: V(0.15, 0, 0), r: 0.06 },
  Shoulder_R: { a: V(-0.02, 0, 0), b: V(-0.15, 0, 0), r: 0.06 },
  Arm_L: { a: V(0, 0.02, 0), b: V(0, -0.285, 0), r: 0.056 },
  Arm_R: { a: V(0, 0.02, 0), b: V(0, -0.285, 0), r: 0.056 },
  Forearm_L: { a: V(0, 0, 0), b: V(0, -0.255, 0), r: 0.045 },
  Forearm_R: { a: V(0, 0, 0), b: V(0, -0.255, 0), r: 0.045 },
  Hand_L: { a: V(0, -0.01, 0), b: V(0, -0.11, 0), r: 0.036 },
  Hand_R: { a: V(0, -0.01, 0), b: V(0, -0.11, 0), r: 0.036 },
  Waist: { a: V(0, -0.1, 0), b: V(0, 0.24, 0), r: 0.14 },
  Thigh_L: { a: V(0, 0.04, 0), b: V(0, -0.44, 0), r: 0.086 },
  Thigh_R: { a: V(0, 0.04, 0), b: V(0, -0.44, 0), r: 0.086 },
  Shin_L: { a: V(0, 0, 0), b: V(0, -0.4, 0), r: 0.055 },
  Shin_R: { a: V(0, 0, 0), b: V(0, -0.4, 0), r: 0.055 },
  Foot_L: { a: V(0, -0.03, -0.05), b: V(0, -0.03, 0.17), r: 0.04 },
  Foot_R: { a: V(0, -0.03, -0.05), b: V(0, -0.03, 0.17), r: 0.04 },
}

/** GPU nano-particle swarm. One draw call, positions are computed in the vertex shader. */
export class NanoParticles {
  points: THREE.Points
  private mat: THREE.ShaderMaterial
  private a = new THREE.Vector3()
  private b = new THREE.Vector3()
  private coreLocal = new THREE.Vector3(0, 0.11, 0.115)
  private count: number

  constructor(private rig: Rig, count: number) {
    this.count = count
    const g = new THREE.BufferGeometry()
    const weights = SUIT_PARTS.map((p) => { const s = SEGS[p]; return Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]) * s.r * (p === 'Back' || p === 'Chest' ? 0.6 : 1) })
    const total = weights.reduce((x, y) => x + y, 0)
    const part = new Float32Array(count), t = new Float32Array(count), ang = new Float32Array(count), rnd = new Float32Array(count * 4)
    let seed = 1337
    const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
    let i = 0
    SUIT_PARTS.forEach((p, pi) => {
      const n = pi === SUIT_PARTS.length - 1 ? count - i : Math.round((weights[pi] / total) * count)
      const seg = SEGS[p]
      for (let k = 0; k < n && i < count; k++, i++) {
        part[i] = pi; t[i] = R()
        const [a0, a1] = seg.angle ?? [0, Math.PI * 2]
        ang[i] = a0 + R() * (a1 - a0)
        rnd[i * 4] = R(); rnd[i * 4 + 1] = R(); rnd[i * 4 + 2] = R(); rnd[i * 4 + 3] = R()
      }
    })
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 1))
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1))
    g.setAttribute('aAngle', new THREE.BufferAttribute(ang, 1))
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4))
    const n = SUIT_PARTS.length
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uSegA: { value: Array.from({ length: n }, () => new THREE.Vector3()) },
        uSegB: { value: Array.from({ length: n }, () => new THREE.Vector3()) },
        uRad: { value: SUIT_PARTS.map((p) => SEGS[p].r) },
        uProg: { value: new Array(n).fill(0) },
        uCore: { value: new THREE.Vector3() },
        uTime: { value: 0 }, uSize: { value: 5.5 }, uScale: { value: 300 }, uFlow: { value: 0 },
      },
    })
    this.points = new THREE.Points(g, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 4
    this.points.visible = false
    this.points.name = 'NanoParticles'
  }

  get particleCount() { return this.count }

  update(time: number, flow: number, progress: (p: SuitPartName) => number, viewportH: number, fovDeg: number) {
    this.points.visible = flow > 0.005
    if (!this.points.visible) return
    const u = this.mat.uniforms
    u.uTime.value = time; u.uFlow.value = flow
    // point size in pixels ≈ world size · (viewport height / (2·tan(fov/2)))
    u.uScale.value = viewportH / (2 * Math.tan((fovDeg * Math.PI) / 360)) * 0.006
    SUIT_PARTS.forEach((p, i) => {
      const bone = this.rig.bones[SUIT_PART_BONE[p]]
      const s = SEGS[p]
      this.a.set(...s.a); bone.localToWorld(this.a); u.uSegA.value[i].copy(this.a)
      this.b.set(...s.b); bone.localToWorld(this.b); u.uSegB.value[i].copy(this.b)
      u.uProg.value[i] = progress(p)
    })
    this.a.copy(this.coreLocal); this.rig.bones.chest.localToWorld(this.a); u.uCore.value.copy(this.a)
  }

  dispose() { this.points.geometry.dispose(); this.mat.dispose() }
}
