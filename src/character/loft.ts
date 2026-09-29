import * as THREE from 'three'

/**
 * Loft: builds smooth organic tubes from cross-section rings (superellipses) along local Y.
 * The body, clothes and suit are all lofts so silhouettes match exactly across forms.
 */
export interface Section { y: number; rx: number; rz: number; cx?: number; cz?: number; n?: number }

export interface LoftOptions {
  radial: number
  rings: number
  capTop?: boolean
  capBottom?: boolean
  /** remove faces whose front angle (from +Z) is within halfAngle(y) — for open jackets */
  openFront?: (y: number) => number
  /** remap the V coordinate into [v0, v1] of a shared texture (for parts split across bones) */
  uvV?: [number, number]
  /** mirror U about the front axis so one left-side texture serves the right side */
  mirrorU?: boolean
  /** grow all sections outward by this amount (clothing thickness) */
  inflate?: number
  /** per-vertex nano reveal order values (0..1), see shaders/nano */
  nano?: (x: number, y: number, z: number, u: number, v: number) => [number, number]
}

export const LOD_SETTINGS = [
  { radial: 44, ringScale: 1 },
  { radial: 24, ringScale: 0.55 },
  { radial: 12, ringScale: 0.3 },
]

const cr = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

export function sampleSection(secs: Section[], s: number): Required<Section> {
  const last = secs.length - 1
  const f = Math.min(Math.max(s, 0), 1) * last
  const i = Math.min(Math.floor(f), last - 1)
  const t = f - i
  const g = (k: number) => secs[Math.min(Math.max(k, 0), last)]
  const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2)
  const c = (k: 'y' | 'rx' | 'rz' | 'cx' | 'cz' | 'n', d: number) =>
    cr(p0[k] ?? d, p1[k] ?? d, p2[k] ?? d, p3[k] ?? d, t)
  return { y: c('y', 0), rx: Math.max(0, c('rx', 0)), rz: Math.max(0, c('rz', 0)), cx: c('cx', 0), cz: c('cz', 0), n: Math.max(1.6, c('n', 2)) }
}

/** front (+Z) surface position of a lofted shape at height y (approximate, for placing facial features) */
export function frontZ(secs: Section[], y: number): number {
  let best = 0, bd = Infinity
  for (let k = 0; k <= 200; k++) {
    const s = sampleSection(secs, k / 200)
    const d = Math.abs(s.y - y)
    if (d < bd) { bd = d; best = s.cz + s.rz }
  }
  return best
}

export function buildLoft(secs: Section[], o: LoftOptions): THREE.BufferGeometry {
  const { radial, rings } = o
  const infl = o.inflate ?? 0
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], n1: number[] = [], n2: number[] = []
  const yMin = Math.min(...secs.map((s) => s.y)), yMax = Math.max(...secs.map((s) => s.y))
  const ringCount = rings + 1
  for (let r = 0; r < ringCount; r++) {
    const s = sampleSection(secs, r / rings)
    const v = (s.y - yMin) / (yMax - yMin || 1)
    for (let i = 0; i <= radial; i++) {
      const u = i / radial
      const th = u * Math.PI * 2 - Math.PI / 2 // seam at world -X (the character's right side); front (+Z) at u = 0.25, back at u = 0.75
      const st = Math.sin(th), ct = Math.cos(th)
      const e = 2 / s.n
      const sx = Math.sign(st) * Math.pow(Math.abs(st), e)
      const sz = Math.sign(ct) * Math.pow(Math.abs(ct), e)
      // th measured from +Z toward +X
      const dx = sx, dz = sz
      const len = Math.hypot(dx * (s.rx || 1e-6), dz * (s.rz || 1e-6)) || 1
      const x = s.cx + sx * (s.rx + infl) , z = s.cz + sz * (s.rz + infl)
      void len
      pos.push(x, s.y, z)
      const uu = o.mirrorU ? (((0.5 - u) % 1) + 1) % 1 : u
      uv.push(uu, o.uvV ? o.uvV[0] + v * (o.uvV[1] - o.uvV[0]) : v)
      const nn = o.nano ? o.nano(x, s.y, z, u, v) : [v, v]
      n1.push(nn[0]); n2.push(nn[1])
    }
  }
  const stride = radial + 1
  const asc = secs[0].y < secs[secs.length - 1].y // winding depends on section order
  const skip = (r: number, i: number) => {
    if (!o.openFront) return false
    const s = sampleSection(secs, (r + 0.5) / rings)
    const a = o.openFront(s.y)
    if (a <= 0) return false
    const u = (i + 0.5) / radial
    const th = u * Math.PI * 2 - Math.PI / 2
    return Math.abs(th) < a
  }
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < radial; i++) {
      if (skip(r, i)) continue
      const a = r * stride + i, b = a + 1, c = a + stride, d = c + 1
      if (asc) idx.push(a, b, c, b, d, c)
      else idx.push(a, c, b, b, c, d)
    }
  }
  const addCap = (ringIdx: number, top: boolean) => {
    const s = sampleSection(secs, ringIdx / rings)
    const center = pos.length / 3
    pos.push(s.cx, s.y, s.cz); uv.push(0.5, top ? 1 : 0)
    const nn = o.nano ? o.nano(s.cx, s.y, s.cz, 0.5, top ? 1 : 0) : [top ? 1 : 0, top ? 1 : 0]
    n1.push(nn[0]); n2.push(nn[1])
    for (let i = 0; i < radial; i++) {
      const a = ringIdx * stride + i, b = a + 1
      const faceUp = (top && asc) || (!top && !asc)
      idx.push(...(faceUp ? [center, a, b] : [center, b, a]))
    }
  }
  if (o.capTop) addCap(rings, true)
  if (o.capBottom) addCap(0, false)

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('aNano', new THREE.Float32BufferAttribute(n1, 1))
  g.setAttribute('aNano2', new THREE.Float32BufferAttribute(n2, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  // weld the seam normals
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute
  for (let r = 0; r < ringCount; r++) {
    const a = r * stride, b = a + radial
    const nx = nrm.getX(a) + nrm.getX(b), ny = nrm.getY(a) + nrm.getY(b), nz = nrm.getZ(a) + nrm.getZ(b)
    const l = Math.hypot(nx, ny, nz) || 1
    nrm.setXYZ(a, nx / l, ny / l, nz / l); nrm.setXYZ(b, nx / l, ny / l, nz / l)
  }
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

export interface LODGeometry { levels: THREE.BufferGeometry[] }

export function buildLoftLOD(secs: Section[], base: Omit<LoftOptions, 'radial' | 'rings'> & { ringsBase: number }): THREE.BufferGeometry[] {
  return LOD_SETTINGS.map((l) =>
    buildLoft(secs, { ...base, radial: l.radial, rings: Math.max(3, Math.round(base.ringsBase * l.ringScale)) }),
  )
}

/** A mesh that can swap between pre-built LOD geometries. */
export class LODMesh extends THREE.Mesh {
  levels: THREE.BufferGeometry[]
  level = 0
  constructor(levels: THREE.BufferGeometry[], material: THREE.Material | THREE.Material[]) {
    super(levels[0], material)
    this.levels = levels
  }
  setLOD(l: number) {
    const k = Math.min(Math.max(l, 0), this.levels.length - 1)
    if (k !== this.level) { this.level = k; this.geometry = this.levels[k] }
  }
  disposeAll() { this.levels.forEach((g) => g.dispose()) }
}

/** Shift section list in Y (convert world-Y authored sections into bone-local). */
export const shiftY = (secs: Section[], dy: number): Section[] => secs.map((s) => ({ ...s, y: s.y - dy }))
export const inflateSecs = (secs: Section[], d: number): Section[] => secs.map((s) => ({ ...s, rx: s.rx + d, rz: s.rz + d }))

/** Interpolate a master profile at arbitrary y (profile must be monotonic in y). */
export function profileAt(master: Section[], y: number): Required<Section> {
  const asc = master[0].y < master[master.length - 1].y
  const ys = master.map((s) => s.y)
  const lo = Math.min(...ys), hi = Math.max(...ys)
  const yy = Math.min(Math.max(y, lo), hi)
  let a = 0, b = 1
  for (let i = 0; i < master.length - 1; i++) {
    const y0 = master[i].y, y1 = master[i + 1].y
    if ((asc && yy >= y0 && yy <= y1) || (!asc && yy <= y0 && yy >= y1)) { a = i; b = i + 1; break }
  }
  const t = (yy - master[a].y) / ((master[b].y - master[a].y) || 1)
  const s = (a + t) / (master.length - 1)
  const r = sampleSection(master, s)
  return { ...r, y: yy }
}

/** Slice a master profile between y0 and y1 (world/master Y) into `count` sections, optionally inflated by fn(y). */
export function sliceProfile(master: Section[], y0: number, y1: number, count = 8, infl: (y: number) => number = () => 0): Section[] {
  const out: Section[] = []
  for (let i = 0; i < count; i++) {
    const y = y0 + ((y1 - y0) * i) / (count - 1)
    const p = profileAt(master, y)
    const d = infl(y)
    out.push({ ...p, rx: p.rx + d, rz: p.rz + d })
  }
  return out
}
