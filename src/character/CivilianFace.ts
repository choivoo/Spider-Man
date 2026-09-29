import * as THREE from 'three'
import { HEAD } from './profiles'
import { frontZ, buildLoft, type Section } from './loft'
import { makeMaterial } from './materials'
import { patchNano } from '../transformation/nanoMaterial'
import type { FaceState } from '../animation/faceTypes'

const N = 22 // mouth contour points

/** Procedural face: eyes with lids, brows, nose, ears and a deformable mouth. All driven by FaceState. */
export class CivilianFace {
  group = new THREE.Group()
  eyeL = new THREE.Group()
  eyeR = new THREE.Group()
  private lidL: THREE.Mesh
  private lidR: THREE.Mesh
  private browL = new THREE.Mesh()
  private browR = new THREE.Mesh()
  private mouthGroup = new THREE.Group()
  private mouthFill: THREE.Mesh
  private lips: THREE.Mesh
  private teeth: THREE.Mesh
  private mouthPos: Float32Array
  private lipPos: Float32Array
  private teethPos: Float32Array
  private baseBrowY = 0.074
  private mouthY = -0.027
  private mouthZ: number

  constructor() {
    const ez = frontZ(HEAD, 0.056)
    const eyeX = 0.0335, eyeY = 0.056
    const eyeballR = 0.0115

    for (const [g, sx] of [[this.eyeL, 1], [this.eyeR, -1]] as const) {
      g.position.set(sx * eyeX, eyeY, ez - 0.0075)
      const ball = new THREE.Mesh(new THREE.SphereGeometry(eyeballR, 24, 18), makeMaterial('sclera', 'Head'))
      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0062, 24), makeMaterial('iris', 'Head'))
      iris.position.z = eyeballR * 0.985
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 16), makeMaterial('pupil', 'Head'))
      pupil.position.z = eyeballR * 0.99 + 0.0002
      const glint = new THREE.Mesh(new THREE.CircleGeometry(0.0013, 8), (() => { const m = new THREE.MeshBasicMaterial({ color: '#ffffff' }); patchNano(m, 'Head', true); return m })())
      glint.position.set(0.0022, 0.0028, eyeballR * 0.99 + 0.0004)
      g.add(ball, iris, pupil, glint)
      this.group.add(g)
    }

    const lidGeo = new THREE.SphereGeometry(eyeballR + 0.0008, 22, 12, 0, Math.PI * 2, 0, 1.7)
    const mk = (geo: THREE.BufferGeometry, x: number, flip: boolean) => {
      const m = new THREE.Mesh(geo, makeMaterial('lid', 'Head'))
      m.position.set(x, eyeY, ez - 0.0075)
      if (flip) m.scale.y = -1
      this.group.add(m)
      return m
    }
    this.lidL = mk(lidGeo, eyeX, false)
    this.lidR = mk(lidGeo, -eyeX, false)

    // brows
    const browGeo = new THREE.CapsuleGeometry(0.0034, 0.03, 4, 8)
    browGeo.rotateZ(Math.PI / 2)
    for (const [b, sx] of [[this.browL, 1], [this.browR, -1]] as const) {
      b.geometry = browGeo
      b.material = makeMaterial('brow', 'Head')
      b.position.set(sx * 0.036, this.baseBrowY, frontZ(HEAD, this.baseBrowY) + 0.0025)
      b.scale.set(1, 1, 0.8)
      this.group.add(b)
    }

    // nose (single soft loft + alae)
    const noseZ = frontZ(HEAD, 0.01)
    const noseSecs: Section[] = [
      { y: 0.046, rx: 0.0055, rz: 0.006, cz: 0.0 },
      { y: 0.03, rx: 0.0075, rz: 0.0095, cz: 0.003 },
      { y: 0.012, rx: 0.0095, rz: 0.0125, cz: 0.008 },
      { y: -0.002, rx: 0.0125, rz: 0.0135, cz: 0.0125 },
      { y: -0.0095, rx: 0.011, rz: 0.008, cz: 0.0105 },
    ]
    const nose = new THREE.Mesh(buildLoft(noseSecs, { radial: 16, rings: 10, capBottom: true }), makeMaterial('skin', 'Head'))
    nose.position.set(0, 0, noseZ - 0.001)
    this.group.add(nose)
    for (const sx of [1, -1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.0066, 12, 10), makeMaterial('skin', 'Head'))
      wing.position.set(sx * 0.0105, -0.004, noseZ + 0.0085)
      this.group.add(wing)
    }

    // ears
    for (const sx of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 12), makeMaterial('skin', 'Head'))
      ear.scale.set(0.28, 1, 0.65); ear.position.set(sx * 0.0765, 0.025, -0.006); ear.rotation.z = sx * 0.12
      this.group.add(ear)
    }

    // mouth (dynamic)
    this.mouthZ = frontZ(HEAD, this.mouthY)
    this.mouthGroup.position.set(0, this.mouthY, this.mouthZ)
    const fillG = new THREE.BufferGeometry()
    this.mouthPos = new Float32Array((N + 1) * 3)
    fillG.setAttribute('position', new THREE.BufferAttribute(this.mouthPos, 3))
    const fi: number[] = []
    for (let i = 0; i < N; i++) fi.push(N, i, (i + 1) % N)
    fillG.setIndex(fi)
    this.mouthFill = new THREE.Mesh(fillG, makeMaterial('mouth', 'Head'))
    this.mouthFill.frustumCulled = false

    const lipG = new THREE.BufferGeometry()
    this.lipPos = new Float32Array(N * 2 * 3)
    lipG.setAttribute('position', new THREE.BufferAttribute(this.lipPos, 3))
    const li: number[] = []
    for (let i = 0; i < N; i++) { const a = i, b = (i + 1) % N; li.push(a, N + a, b, b, N + a, N + b) }
    lipG.setIndex(li)
    this.lips = new THREE.Mesh(lipG, makeMaterial('lip', 'Head'))
    this.lips.frustumCulled = false

    const teethG = new THREE.BufferGeometry()
    this.teethPos = new Float32Array(8 * 3)
    teethG.setAttribute('position', new THREE.BufferAttribute(this.teethPos, 3))
    teethG.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6])
    this.teeth = new THREE.Mesh(teethG, makeMaterial('teeth', 'Head'))
    this.teeth.frustumCulled = false
    this.mouthGroup.add(this.mouthFill, this.teeth, this.lips)
    this.group.add(this.mouthGroup)
    this.update(null)
  }

  /** gaze in radians relative to head; yaw+ looks to character's left (+X) */
  setGaze(yaw: number, pitch: number) {
    for (const g of [this.eyeL, this.eyeR]) g.rotation.set(-pitch, yaw, 0)
  }

  update(f: FaceState | null) {
    const F = f ?? {
      Blink_L: 0, Blink_R: 0, Smile_L: 0, Smile_R: 0, MouthOpen: 0, BrowUp: 0, BrowDown: 0, Surprise: 0, Angry: 0, Sad: 0, Squint: 0,
      mouth: { open: 0, width: 1, round: 0, fv: 0 },
    } as FaceState
    // --- eyelids
    const wide = F.Surprise * 0.5
    const closure = (blink: number) => Math.min(1, blink + F.Squint * 0.32 + F.Sad * 0.1 - wide * 0.4)
    const setLid = (m: THREE.Mesh, c: number) => {
      // scale (not .visible): visibility belongs to the nano reveal system, which hides the whole face while the mask is on
      m.scale.setScalar(c > 0.02 ? 1 : 0.0001)
      m.rotation.x = THREE.MathUtils.lerp(-0.25, 0.55, Math.max(0, c))
    }
    setLid(this.lidL, closure(F.Blink_L))
    setLid(this.lidR, closure(F.Blink_R))
    // --- brows
    const up = F.BrowUp + F.Surprise * 0.9 - F.BrowDown * 0.8 - F.Angry * 0.3
    const innerDown = F.Angry * 0.55 - F.Sad * 0.6 // + = inner end down
    for (const [b, sx] of [[this.browL, 1], [this.browR, -1]] as const) {
      b.position.y = this.baseBrowY + up * 0.008
      b.rotation.z = sx * innerDown * 0.5
      b.position.z = frontZ(HEAD, b.position.y) + 0.0025
    }
    // --- mouth
    const m = F.mouth
    const smile = (F.Smile_L + F.Smile_R) * 0.5
    const asym = F.Smile_L - F.Smile_R
    const W = 0.0225 * m.width * (1 + smile * 0.22 - F.Sad * 0.05) * (1 - m.round * 0.18)
    const H = Math.min(0.036, m.open * 0.03 + F.MouthOpen * 0.026 + F.Surprise * 0.012)
    const topH = H * 0.32, botH = H * 0.68
    const cx = this.mouthPos
    const curve = 1.9 // wrap around the face
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2
      const c = Math.cos(t), s = Math.sin(t)
      const x = W * c
      let y = s >= 0 ? topH * s : botH * s
      // lift corners (smile) / drop (sad); asym gives one-sided smirk
      const corner = c * c * c * c
      const side = x >= 0 ? F.Smile_L : F.Smile_R
      y += corner * (side * 0.0075 - F.Sad * 0.005)
      y += (s >= 0 ? 1 : 0.4) * m.round * 0.0015 * s
      if (m.fv > 0 && s < 0) y += m.fv * 0.0035 // lower lip tucks up for F/V
      cx[i * 3] = x; cx[i * 3 + 1] = y - (H > 0.002 ? 0 : 0)
      cx[i * 3 + 2] = -curve * x * x * 3.2 + 0.001
    }
    void asym
    cx[N * 3] = 0; cx[N * 3 + 1] = -botH * 0.2; cx[N * 3 + 2] = -0.004
    const lp = this.lipPos
    const lipT = 0.0033 + smile * 0.0004, lipB = 0.0048
    for (let i = 0; i < N; i++) {
      const x = cx[i * 3], y = cx[i * 3 + 1], z = cx[i * 3 + 2]
      const upperHalf = Math.sin((i / N) * Math.PI * 2) >= 0
      const dir = upperHalf ? 1 : -1
      const th = upperHalf ? lipT : lipB
      const tight = Math.abs(x) > W * 0.85 ? 0.5 : 1
      lp[i * 3] = x; lp[i * 3 + 1] = y; lp[i * 3 + 2] = z + 0.0008
      lp[(N + i) * 3] = x * (1 + 0.04 * (1 - tight)); lp[(N + i) * 3 + 1] = y + dir * th * tight; lp[(N + i) * 3 + 2] = z + 0.0016 + 0.0012 * tight
    }
    // teeth (upper row), only meaningful when open
    const tp = this.teethPos
    const tw = W * 0.72, th2 = Math.min(H * 0.34, 0.0075)
    const yTop = topH * 0.98
    const xs = [-tw, -tw * 0.35, tw * 0.35, tw]
    for (let k = 0; k < 4; k++) {
      const xx = xs[k]
      const zz = -curve * xx * xx * 3.2 + 0.0006
      tp[k * 3] = xx; tp[k * 3 + 1] = yTop * (1 - (xx * xx) / (W * W) * 0.5); tp[k * 3 + 2] = zz
      tp[(4 + k) * 3] = xx; tp[(4 + k) * 3 + 1] = tp[k * 3 + 1] - th2; tp[(4 + k) * 3 + 2] = zz
    }
    this.teeth.scale.setScalar(H > 0.006 ? 1 : 0.0001)
    ;(this.mouthFill.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.lips.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.teeth.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
  }
}
