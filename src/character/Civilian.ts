import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildLoft, buildLoftLOD, LODMesh, LOD_SETTINGS, sliceProfile, shiftY, sampleSection, type Section } from './loft'
import { TORSO, ARM, LEG, NECK, HEAD, SHOE } from './profiles'
import { makeMaterial, type MatKind } from './materials'
import { restWorldY, type BoneName, type SuitPartName } from './rigSpec'
import { patchNano } from '../transformation/nanoMaterial'
import { bakeNanoForTree } from '../transformation/bakeNano'
import type { Rig } from './ProceduralRig'
import { CivilianFace } from './CivilianFace'

/** Which suit region does a civilian mesh belong to (and therefore dissolve with)? */
export function partFromName(name: string): SuitPartName {
  const side = /_R$/.test(name) ? 'R' : 'L'
  if (/Pelvis|Abdomen|Tee_Waist|Pants_Hips|Blazer_Skirt|Blazer_Waist/.test(name)) return 'Waist'
  if (/Skin_Chest|Tee_Chest|Blazer_Chest|Lapel/.test(name)) return 'Chest'
  if (/Neck/.test(name)) return 'Neck'
  if (/UpperArm|Sleeve_Upper/.test(name)) return `Arm_${side}` as SuitPartName
  if (/ForeArm|Sleeve_Fore/.test(name)) return `Forearm_${side}` as SuitPartName
  if (/Hand/.test(name)) return `Hand_${side}` as SuitPartName
  if (/Thigh/.test(name)) return `Thigh_${side}` as SuitPartName
  if (/Shin/.test(name)) return `Shin_${side}` as SuitPartName
  if (/Shoe|Sole|Lace/.test(name)) return `Foot_${side}` as SuitPartName
  return 'Head'
}

export interface CivilianModel {
  group: THREE.Group
  face: CivilianFace
  lodMeshes: LODMesh[]
  hairInstanced: THREE.InstancedMesh
  dispose(): void
}

/** deterministic PRNG so the hair is identical every load */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

export function ellipse(secs: Section[], y: number, th: number, infl = 0) {
  // point on master profile ring at height y and front-angle th (from +Z toward +X)
  const s = sampleSectionAtY(secs, y)
  const st = Math.sin(th), ct = Math.cos(th)
  const e = 2 / s.n
  return new THREE.Vector3(
    s.cx + Math.sign(st) * Math.pow(Math.abs(st), e) * (s.rx + infl),
    y,
    s.cz + Math.sign(ct) * Math.pow(Math.abs(ct), e) * (s.rz + infl),
  )
}
function sampleSectionAtY(secs: Section[], y: number) {
  // find s by bisection (profiles are monotone in y)
  const asc = secs[0].y < secs[secs.length - 1].y
  let lo = 0, hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const my = sampleSection(secs, mid).y
    if ((my < y) === asc) lo = mid; else hi = mid
  }
  return sampleSection(secs, (lo + hi) / 2)
}

export function buildCivilian(rig: Rig): CivilianModel {
  const group = new THREE.Group()
  group.name = 'CivilianBody'
  const lodMeshes: LODMesh[] = []

  const addLoft = (bone: BoneName, secs: Section[], kind: MatKind, o: { rings?: number; capTop?: boolean; capBottom?: boolean; openFront?: (y: number) => number; name: string; double?: boolean; parent?: THREE.Object3D }) => {
    const geos = buildLoftLOD(secs, { ringsBase: o.rings ?? 16, capTop: o.capTop, capBottom: o.capBottom, openFront: o.openFront })
    const mat = makeMaterial(kind, partFromName(o.name), { double: o.double })
    const m = new LODMesh(geos, mat)
    m.name = o.name
    m.castShadow = true; m.receiveShadow = true
    ;(o.parent ?? rig.bones[bone]).add(m)
    lodMeshes.push(m)
    return m
  }

  const wy = (b: BoneName) => restWorldY(b)
  const T = (y0: number, y1: number, n: number, infl: (y: number) => number = () => 0) => sliceProfile(TORSO, y0, y1, n, infl)

  // ===================== SKIN =====================
  // torso (mostly hidden, but visible during transformation and under open clothes)
  addLoft('hips', shiftY(T(0.86, 1.08, 6), wy('hips')), 'skin', { name: 'Skin_Pelvis', capBottom: true })
  addLoft('spine', shiftY(T(1.04, 1.24, 6), wy('spine')), 'skin', { name: 'Skin_Abdomen' })
  addLoft('chest', shiftY(T(1.2, 1.49, 9), wy('chest')), 'skin', { name: 'Skin_Chest', capTop: true })
  addLoft('neck', shiftY(sliceProfile(NECK, 1.42, 1.58, 5), wy('neck')), 'skin', { name: 'Skin_Neck', rings: 8 })

  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1
    void sx
    addLoft(`upperArm${side}` as BoneName, sliceProfile(ARM, 0.032, -0.3, 8), 'skin', { name: `Skin_UpperArm_${side}`, capTop: true })
    addLoft(`foreArm${side}` as BoneName, shiftY(sliceProfile(ARM, -0.27, -0.545, 8), -0.285), 'skin', { name: `Skin_ForeArm_${side}` })
    addLoft(`thigh${side}` as BoneName, sliceProfile(LEG, 0.10, -0.45, 10), 'skin', { name: `Skin_Thigh_${side}` })
    addLoft(`shin${side}` as BoneName, shiftY(sliceProfile(LEG, -0.43, -0.845, 10), -0.44), 'skin', { name: `Skin_Shin_${side}` })
    // hand
    const hg = buildHandLOD(side, 0)
    const hand = new LODMesh(hg, makeMaterial('skin', `Hand_${side}`)); hand.name = `Skin_Hand_${side}`; hand.castShadow = true
    rig.bones[`hand${side}` as BoneName].add(hand); lodMeshes.push(hand)
  }

  // ===================== HEAD =====================
  const head = rig.bones.head
  addLoft('head', HEAD, 'skin', { name: 'Skin_Head', rings: 24, capTop: true, capBottom: true })
  const face = new CivilianFace()
  face.group.name = 'Face'
  head.add(face.group)

  // hair
  const hairCap = buildHairCap()
  const capMesh = new LODMesh(hairCap, makeMaterial('hair', 'Head')); capMesh.name = 'Hair_Cap'; head.add(capMesh); lodMeshes.push(capMesh)
  const hairInstanced = buildCurls()
  head.add(hairInstanced)

  // ===================== CLOTHES =====================
  // tee
  addLoft('spine', shiftY(T(1.02, 1.24, 6, () => 0.004), wy('spine')), 'tee', { name: 'Tee_Waist' })
  addLoft('chest', shiftY(T(1.2, 1.47, 9, () => 0.005), wy('chest')), 'tee', { name: 'Tee_Chest', capTop: false })
  {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.0075, 8, 32), makeMaterial('tee', 'Neck'))
    collar.rotation.x = Math.PI / 2 - 0.12; collar.position.set(0, 1.455 - wy('neck') + 0.005, 0.006)
    rig.bones.neck.add(collar)
  }

  // pants
  const pInfl = (y: number) => 0.011 - Math.max(0, -y - 0.5) * 0.008
  addLoft('hips', shiftY(T(0.86, 1.06, 6, () => 0.01), wy('hips')), 'pants', { name: 'Pants_Hips', double: true })
  for (const side of ['L', 'R'] as const) {
    addLoft(`thigh${side}` as BoneName, sliceProfile(LEG, 0.10, -0.45, 10, () => 0.011), 'pants', { name: `Pants_Thigh_${side}`, double: true })
    const shinSecs = sliceProfile(LEG, -0.43, -0.835, 10, (y) => pInfl(y))
    addLoft(`shin${side}` as BoneName, shiftY(shinSecs, -0.44), 'pants', { name: `Pants_Shin_${side}`, double: true })
  }

  // shoes
  for (const side of ['L', 'R'] as const) {
    const foot = rig.bones[`foot${side}` as BoneName]
    const sec: Section[] = SHOE.map((s) => ({ y: s.z, rx: s.hw, rz: s.hh, cz: -s.cy, n: 2.6 }))
    const geos = LOD_SETTINGS.map((l) => {
      const g = buildLoft(sec, { radial: l.radial, rings: Math.max(6, Math.round(16 * l.ringScale)), capTop: true, capBottom: true })
      g.rotateX(Math.PI / 2)
      return g
    })
    const shoe = new LODMesh(geos, makeMaterial('shoe', `Foot_${side}`)); shoe.name = `Shoe_${side}`; shoe.castShadow = true
    foot.add(shoe); lodMeshes.push(shoe)
    const soleSec: Section[] = SHOE.map((s) => ({ y: s.z, rx: s.hw + 0.002, rz: 0.008, cz: -(s.cy - s.hh + 0.004), n: 2.4 }))
    const soleGeos = LOD_SETTINGS.map((l) => {
      const g = buildLoft(soleSec, { radial: Math.max(8, l.radial / 2), rings: 8, capTop: true, capBottom: true })
      g.rotateX(Math.PI / 2)
      return g
    })
    const sole = new LODMesh(soleGeos, makeMaterial('sole', `Foot_${side}`)); sole.name = `Sole_${side}`; foot.add(sole); lodMeshes.push(sole)
    // laces
    for (let i = 0; i < 4; i++) {
      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.0035, 0.006), makeMaterial('lace', `Foot_${side}`))
      const z = -0.005 + i * 0.024
      lace.position.set(0, -0.0055 - i * 0.0085 - 0.014, z + 0.002)
      lace.position.y = -0.033 + 0.03 - i * 0.0004 - 0.0
      lace.position.y = 0.0 - 0.01 - i * 0.0075
      lace.rotation.x = -0.45 + i * 0.05
      lace.position.set(0, -0.004 - i * 0.0065, 0.004 + i * 0.023)
      foot.add(lace)
    }
  }

  // blazer
  const blazerInfl = (y: number) => 0.02 + Math.max(0, 1.0 - y) * 0.06
  const open = (y: number) => (y < 1.3 ? 0.5 : 0.5 + (y - 1.3) * 1.6)
  addLoft('hips', shiftY(T(0.87, 1.08, 8, blazerInfl), wy('hips')), 'blazer', { name: 'Blazer_Skirt', openFront: (y) => open(y + wy('hips')), double: true })
  addLoft('spine', shiftY(T(1.04, 1.24, 6, blazerInfl), wy('spine')), 'blazer', { name: 'Blazer_Waist', openFront: (y) => open(y + wy('spine')), double: true })
  addLoft('chest', shiftY(T(1.2, 1.47, 9, () => 0.02), wy('chest')), 'blazer', { name: 'Blazer_Chest', openFront: (y) => open(y + wy('chest')), double: true })
  for (const side of ['L', 'R'] as const) {
    addLoft(`upperArm${side}` as BoneName, sliceProfile(ARM, 0.032, -0.3, 8, () => 0.017), 'blazer', { name: `Sleeve_Upper_${side}`, capTop: true, double: true })
    addLoft(`foreArm${side}` as BoneName, shiftY(sliceProfile(ARM, -0.27, -0.53, 8, () => 0.016), -0.285), 'blazer', { name: `Sleeve_Fore_${side}`, double: true })
    const fa = rig.bones[`foreArm${side}` as BoneName]
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), makeMaterial('button', `Forearm_${side}`))
      b.position.set(0, -0.215 + k * 0.021, -0.05); b.scale.set(1, 1, 0.6)
      b.position.set(side === 'L' ? 0.015 : -0.015, -0.2 + k * 0.022, 0.042)
      fa.add(b)
    }
  }
  // lapels: ribbons on the blazer surface along the open edge
  for (const sx of [1, -1]) {
    const lap = buildLapel(sx, wy('chest'))
    rig.bones.chest.add(lap)
  }
  // pocket flaps
  for (const sx of [1, -1]) {
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.012), makeMaterial('blazer', 'Waist'))
    const th = sx * 1.12, y = 0.9
    const p = ellipse(TORSO, y, th, blazerInfl(y) + 0.004)
    flap.position.set(p.x, y - wy('hips'), p.z); flap.rotation.y = th; flap.rotation.z = -sx * 0.12
    rig.bones.hips.add(flap)
  }

  group.add(rig.bones.hips === undefined ? new THREE.Group() : new THREE.Group())
  bakeNanoForTree(rig)
  const dispose = () => {
    lodMeshes.forEach((m) => m.disposeAll())
  }
  return { group, face, lodMeshes, hairInstanced, dispose }
}

function buildLapel(sx: number, chestY: number): THREE.Mesh {
  const rows = 14, cols = 4
  const pos: number[] = [], idx: number[] = []
  const y0 = 1.13, y1 = 1.44
  const open = (y: number) => (y < 1.3 ? 0.5 : 0.5 + (y - 1.3) * 1.6)
  const w = (y: number) => {
    const t = (y - y0) / (y1 - y0)
    if (t < 0.7) return 0.012 + t * 0.06
    if (t < 0.78) return 0.03
    return 0.05 - (t - 0.78) * 0.09
  }
  for (let r = 0; r <= rows; r++) {
    const y = y0 + ((y1 - y0) * r) / rows
    const a = open(y)
    for (let c = 0; c <= cols; c++) {
      const th = sx * (a + (c / cols) * w(y) / 0.13)
      const p = ellipse(TORSO, y, th, 0.02 + (c === 0 ? 0.004 : 0.002))
      pos.push(p.x, p.y - chestY, p.z)
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1
    if (sx > 0) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx); g.computeVertexNormals()
  const m = new THREE.Mesh(g, makeMaterial('lapel', 'Chest', { double: true }))
  m.name = sx > 0 ? 'Lapel_L' : 'Lapel_R'
  return m
}

/** Hand = palm loft + 4 fingers (2 segments) + thumb, merged into one geometry per LOD. `inflate` lets the suit glove reuse it. */
export function buildHandLOD(side: 'L' | 'R', inflate: number): THREE.BufferGeometry[] {
  const sx = side === 'L' ? 1 : -1
  return LOD_SETTINGS.map((l, li) => {
    const palm = buildLoft(
      [
        { y: 0.012, rx: 0.026 + inflate, rz: 0.017 + inflate },
        { y: -0.02, rx: 0.034 + inflate, rz: 0.019 + inflate },
        { y: -0.075, rx: 0.039 + inflate, rz: 0.019 + inflate },
        { y: -0.098, rx: 0.037 + inflate, rz: 0.017 + inflate },
      ],
      { radial: Math.max(8, l.radial / 2), rings: 6, capBottom: true, capTop: true },
    )
    const parts: THREE.BufferGeometry[] = [palm]
    const seg = (r: number, len: number, x: number, y: number, z: number, rx: number, rz = 0) => {
      const g = new THREE.CapsuleGeometry(r + inflate, len, 3, li === 2 ? 4 : 6)
      g.translate(0, -len / 2 - r, 0)
      g.rotateX(rx); g.rotateZ(rz)
      g.translate(x, y, z)
      return g
    }
    const fingers: [number, number, number][] = [[-0.0285, 0.95, 0.06], [-0.0095, 1.0, 0.0], [0.0095, 0.96, -0.04], [0.0285, 0.8, -0.07]]
    for (const [fx, sc, spread] of fingers) {
      const x = fx * sx
      const l1 = 0.038 * sc, l2 = 0.03 * sc
      parts.push(seg(0.0078, l1, x, -0.092, 0.002, -0.22, spread * sx))
      // second segment hangs from end of the first
      const cur = -0.22, ey = -0.092 - Math.cos(cur) * (l1 + 0.0156), ez = 0.002 - Math.sin(cur) * (l1 + 0.0156)
      parts.push(seg(0.0072, l2, x + Math.sin(spread * sx) * (l1 + 0.0156) * 0.3, ey, ez, -0.55, spread * sx))
    }
    // thumb
    const th = seg(0.0095, 0.034, 0.03 * sx, -0.012, 0.012, -0.35, sx * 0.55)
    parts.push(th)
    const th2 = seg(0.0085, 0.024, 0.052 * sx, -0.044, 0.02, -0.5, sx * 0.35)
    parts.push(th2)
    // normalise attributes then merge
    const norm = parts.map((g) => {
      const n = g.index ? g : g
      if (!n.getAttribute('aNano')) {
        const c = n.getAttribute('position').count
        n.setAttribute('aNano', new THREE.Float32BufferAttribute(new Float32Array(c).fill(0.5), 1))
        n.setAttribute('aNano2', new THREE.Float32BufferAttribute(new Float32Array(c).fill(0.5), 1))
      }
      return n
    })
    const merged = mergeGeometries(norm.map((g) => (g.index ? g : g)), false)!
    // recompute aNano from y (top = wrist)
    const p = merged.getAttribute('position'); const a = merged.getAttribute('aNano') as THREE.BufferAttribute; const a2 = merged.getAttribute('aNano2') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) { const v = Math.min(1, Math.max(0, (-p.getY(i)) / 0.18)); a.setX(i, v); a2.setX(i, v) }
    merged.computeVertexNormals()
    return merged
  })
}

function buildHairCap(): THREE.BufferGeometry[] {
  // The cap wraps the crown and back of the skull; below the hairline its front and sides are tucked
  // inside the head so the visible intersection forms a natural hairline / sideburn / nape shape.
  const secs: Section[] = HEAD.filter((s) => s.y >= -0.012).map((s) => {
    const cz0 = s.cz ?? 0
    const front = cz0 + s.rz, rear = cz0 - s.rz
    const y = s.y
    const hairline = 0.104
    const frontOut = y < hairline - 0.006 ? -0.016 : y < hairline ? -0.004 : 0.007
    const sideOut = y < 0.06 ? -0.006 : y < 0.085 ? 0.004 : 0.011
    const f2 = front + frontOut, r2 = rear - 0.012
    return { y, rx: s.rx + sideOut, rz: (f2 - r2) / 2, cz: (f2 + r2) / 2, n: 2.2 }
  })
  return buildLoftLOD(secs, { ringsBase: 18, capTop: true })
}

function buildCurls(): THREE.InstancedMesh {
  const R = rng(20240607)
  const geo = new THREE.IcosahedronGeometry(1, 1)
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0.05, vertexColors: false })
  patchNano(mat, 'Head', true)
  const items: { m: THREE.Matrix4; c: THREE.Color }[] = []
  const tmp = new THREE.Object3D()
  const base = new THREE.Color('#3b2416')
  for (let k = 0; k < 420; k++) {
    const y = -0.012 + Math.pow(R(), 0.8) * 0.2
    const th = R() * Math.PI * 2 - Math.PI
    const a = Math.abs(th)
    // exclusions: forehead / temple / ears
    if (a < 1.2 && y < 0.098) continue
    if (a >= 1.2 && a < 1.75 && y < 0.07 && y > -0.01) continue
    if (a >= 1.35 && a < 1.95 && y > 0.0 && y < 0.055) continue
    if (a < 1.9 && y < 0.02) continue
    const s = sampleSectionAtY(HEAD, Math.min(y, 0.178))
    const st = Math.sin(th), ct = Math.cos(th)
    const push = 0.009 + R() * 0.008 + (y > 0.11 ? 0.008 : 0) + (a < 1 && y > 0.1 ? 0.012 : 0)
    const x = s.cx + st * (s.rx + push)
    const z = s.cz + ct * (s.rz + push) + (a < 0.9 && y > 0.12 ? 0.008 : 0)
    const yy = y + (a < 1 && y > 0.1 ? 0.01 : 0) + (y > 0.15 ? 0.006 : 0)
    const r = 0.014 + R() * 0.011
    tmp.position.set(x, yy, z)
    tmp.rotation.set(R() * 6, R() * 6, R() * 6)
    tmp.scale.set(r * (0.9 + R() * 0.5), r * (0.8 + R() * 0.5), r * (0.9 + R() * 0.5))
    tmp.updateMatrix()
    const c = base.clone().offsetHSL((R() - 0.5) * 0.02, (R() - 0.5) * 0.15, (R() - 0.5) * 0.07)
    items.push({ m: tmp.matrix.clone(), c })
  }
  const inst = new THREE.InstancedMesh(geo, mat, items.length)
  items.forEach((it, i) => { inst.setMatrixAt(i, it.m); inst.setColorAt(i, it.c) })
  inst.castShadow = true
  inst.name = 'Hair_Curls'
  return inst
}
