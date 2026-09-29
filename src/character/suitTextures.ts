import * as THREE from 'three'

/**
 * Procedural suit textures (colour, roughness/metalness, emissive, bump) painted from Reference A/B:
 *  RED   #C81D25 semi-metallic polymer     BLACK #080A0F micro-textured fabric     GOLD #B99545 brushed nano-metal
 *  cyan/white glow strips, raised web lines, chest spider emblem.
 * Painted in a flat "material id" canvas (R=red, G=black, B=gold) + a web-line canvas + a glow canvas, then composed.
 * Texture space: u around the part (0.25 = front, 0.5 = character's left, 0.75 = back), v up (0 = bottom of slice).
 */

export const RED = '#c81d25', BLACK = '#080a0f', GOLD = '#b99545'
const ID_RED = '#ff0000', ID_BLK = '#00ff00', ID_GLD = '#0000ff'

export interface SuitTex { map: THREE.CanvasTexture; orm: THREE.CanvasTexture; emissive: THREE.CanvasTexture; bump: THREE.CanvasTexture }

export type PaintKind =
  | 'chest' | 'waist' | 'neck' | 'head' | 'arm' | 'forearm' | 'hand' | 'thigh' | 'shin' | 'foot'

/** [width, height, circumference m, slice height m] at texScale 1 */
const DIMS: Record<PaintKind, [number, number, number, number]> = {
  chest: [1024, 512, 0.9, 0.29],
  waist: [1024, 512, 0.86, 0.38],
  neck: [256, 128, 0.34, 0.16],
  head: [512, 512, 0.5, 0.235],
  arm: [256, 512, 0.31, 0.33],
  forearm: [256, 512, 0.23, 0.275],
  hand: [256, 256, 0.2, 0.18],
  thigh: [256, 512, 0.5, 0.55],
  shin: [256, 512, 0.32, 0.41],
  foot: [256, 512, 0.3, 0.29],
}

interface Ctxs { id: CanvasRenderingContext2D; web: CanvasRenderingContext2D; glow: CanvasRenderingContext2D; relief: CanvasRenderingContext2D; W: number; H: number; circ: number; hgt: number }

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  return c.getContext('2d', { willReadFrequently: true })!
}

/** run `fn` in metric coordinates: x metres to the right of `cu` (u), y metres up from the bottom of the slice */
function metric(c: Ctxs, ctx: CanvasRenderingContext2D, cu: number, fn: () => void) {
  ctx.save()
  ctx.translate(cu * c.W, c.H)
  ctx.scale(c.W / c.circ, -c.H / c.hgt)
  fn()
  ctx.restore()
}
/** also draw the same thing wrapped around the seam (so shapes near u=0/1 tile) */
const wrapped = (c: Ctxs, ctx: CanvasRenderingContext2D, cu: number, fn: () => void) => {
  for (const d of [-1, 0, 1]) metric(c, ctx, cu + d, fn)
}
const poly = (ctx: CanvasRenderingContext2D, pts: number[][], fill: string) => {
  ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill()
}
const stroke = (ctx: CanvasRenderingContext2D, pts: number[][], color: string, w: number) => {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke()
}
const rect = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, fill: string) => { ctx.fillStyle = fill; ctx.fillRect(x0, y0, x1 - x0, y1 - y0) }
const fillAll = (c: Ctxs, ctx: CanvasRenderingContext2D, color: string) => { ctx.fillStyle = color; ctx.fillRect(0, 0, c.W, c.H) }
/** horizontal band across the whole circumference between two heights (metres) */
const band = (c: Ctxs, ctx: CanvasRenderingContext2D, y0: number, y1: number, color: string) => {
  ctx.fillStyle = color; ctx.fillRect(0, c.H - (y1 / c.hgt) * c.H, c.W, ((y1 - y0) / c.hgt) * c.H)
}

/** scalloped web: vertical strands + sagging horizontal arcs */
function web(c: Ctxs, cols: number, rows: number, sag = 0.12, top = 0) {
  const ctx = c.web
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, c.W / 512 * 1.6); ctx.lineCap = 'round'
  for (let i = 0; i <= cols; i++) { const x = (i / cols) * c.W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.H); ctx.stroke() }
  const rh = (c.H * (1 - top)) / rows
  for (let r = 0; r <= rows; r++) {
    const y = top * c.H + r * rh
    for (let i = 0; i < cols; i++) {
      const x0 = (i / cols) * c.W, x1 = ((i + 1) / cols) * c.W
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + rh * sag * 2.4, x1, y); ctx.stroke()
    }
  }
}

function glowRect(c: Ctxs, cu: number, x: number, y: number, w: number, h: number) {
  wrapped(c, c.glow, cu, () => { c.glow.fillStyle = '#fff'; c.glow.fillRect(x - w / 2, y - h / 2, w, h) })
}

/** spider emblem (front: black on red / back: red on black) in metric coords, origin at emblem centre */
function spiderEmblem(ctx: CanvasRenderingContext2D, fill: string, outline: string, s: number) {
  ctx.save(); ctx.scale(s, s)
  const legs: number[][][] = [
    [[0.02, 0.05], [0.07, 0.10], [0.13, 0.115], [0.185, 0.07]],
    [[0.03, 0.02], [0.10, 0.045], [0.165, 0.02], [0.195, -0.04]],
    [[0.03, -0.015], [0.10, -0.035], [0.15, -0.085], [0.16, -0.14]],
    [[0.02, -0.045], [0.06, -0.095], [0.085, -0.15], [0.075, -0.2]],
  ]
  for (const sx of [1, -1]) for (const leg of legs) {
    const pts = leg.map(([x, y]) => [x * sx, y])
    stroke(ctx, pts, outline, 0.0125); stroke(ctx, pts, fill, 0.0075)
  }
  const body = [[0, 0.075], [0.04, 0.045], [0.04, -0.03], [0, -0.075], [-0.04, -0.03], [-0.04, 0.045]]
  poly(ctx, body.map(([x, y]) => [x * 1.12, y * 1.1]), outline)
  poly(ctx, body, fill)
  ctx.restore()
}

export function paintSuit(kind: PaintKind, texScale = 1): SuitTex {
  const [bw, bh, circ, hgt] = DIMS[kind]
  const W = Math.max(64, Math.round(bw * texScale)), H = Math.max(64, Math.round(bh * texScale))
  const c: Ctxs = { id: mk(W, H), web: mk(W, H), glow: mk(W, H), relief: mk(W, H), W, H, circ, hgt }
  const { id, glow } = c
  c.relief.fillStyle = 'rgb(128,128,128)'; c.relief.fillRect(0, 0, W, H)
  glow.fillStyle = '#000'; glow.fillRect(0, 0, W, H); c.web.fillStyle = '#000'; c.web.fillRect(0, 0, W, H)
  const gl = 0.0032 // gold pin-stripe width (m)

  switch (kind) {
    case 'chest': {
      fillAll(c, id, ID_BLK)
      // ---- FRONT (u = .25): red vest, red shoulders, gold outlines, black emblem
      metric(c, id, 0.25, () => {
        poly(id, [[-0.05, 0.3], [0.05, 0.3], [0.078, 0.12], [0.095, -0.01], [-0.095, -0.01], [-0.078, 0.12]], ID_RED)
        for (const sx of [1, -1]) poly(id, [[sx * 0.1, 0.3], [sx * 0.2, 0.3], [sx * 0.215, 0.17], [sx * 0.14, 0.155]], ID_RED)
        for (const sx of [1, -1]) stroke(id, [[sx * 0.05, 0.3], [sx * 0.078, 0.12], [sx * 0.095, -0.01]], ID_GLD, gl * 1.6)
        for (const sx of [1, -1]) stroke(id, [[sx * 0.1, 0.3], [sx * 0.14, 0.155], [sx * 0.215, 0.17]], ID_GLD, gl * 1.4)
        rect(id, -0.3, 0.0, 0.3, 0.008, ID_GLD)
        id.save(); id.translate(0, 0.155); spiderEmblem(id, ID_BLK, ID_GLD, 1); id.restore()
      })
      // ---- BACK (u = .75): black with red emblem (gold outline) and shoulder panels
      metric(c, id, 0.75, () => {
        for (const sx of [1, -1]) poly(id, [[sx * 0.09, 0.3], [sx * 0.2, 0.3], [sx * 0.215, 0.14], [sx * 0.11, 0.1]], ID_RED)
        for (const sx of [1, -1]) stroke(id, [[sx * 0.09, 0.3], [sx * 0.11, 0.1], [sx * 0.215, 0.14]], ID_GLD, gl * 1.4)
        id.save(); id.translate(0, 0.15); spiderEmblem(id, ID_RED, ID_GLD, 1.05); id.restore()
        rect(id, -0.3, 0.0, 0.3, 0.008, ID_GLD)
      })
      web(c, 64, 12, 0.16)
      glowRect(c, 0.25, -0.13, 0.03, 0.035, 0.007); glowRect(c, 0.25, 0.13, 0.03, 0.035, 0.007)
      glowRect(c, 0.25, -0.185, 0.245, 0.03, 0.006); glowRect(c, 0.25, 0.185, 0.245, 0.03, 0.006)
      break
    }
    case 'waist': {
      fillAll(c, id, ID_BLK)
      // slice: y=.86 (bottom) … 1.24 (top). belt band at 1.03–1.075 → 0.17–0.215 m
      metric(c, id, 0.25, () => {
        poly(id, [[-0.095, 0.4], [0.095, 0.4], [0.07, 0.235], [-0.07, 0.235]], ID_RED)
        for (const sx of [1, -1]) stroke(id, [[sx * 0.095, 0.4], [sx * 0.07, 0.235]], ID_GLD, gl * 1.6)
      })
      band(c, id, 0.17, 0.235, ID_GLD)
      band(c, id, 0.18, 0.2, ID_BLK); band(c, id, 0.205, 0.225, ID_BLK)
      metric(c, id, 0.25, () => { poly(id, [[-0.03, 0.26], [0.03, 0.26], [0.045, 0.2], [0.03, 0.14], [-0.03, 0.14], [-0.045, 0.2]], ID_GLD); poly(id, [[-0.02, 0.245], [0.02, 0.245], [0.03, 0.2], [0.02, 0.155], [-0.02, 0.155], [-0.03, 0.2]], ID_BLK) })
      // plating seams
      id.strokeStyle = ID_GLD; id.lineWidth = 1.5
      for (const cu of [0.06, 0.16, 0.34, 0.44, 0.56, 0.94]) { id.beginPath(); id.moveTo(cu * W, H * 0.62); id.lineTo(cu * W, H); id.stroke() }
      web(c, 64, 10, 0.16, 0)
      glowRect(c, 0.25, 0, 0.2, 0.05, 0.006)
      glowRect(c, 0.25, -0.12, 0.19, 0.03, 0.006); glowRect(c, 0.25, 0.12, 0.19, 0.03, 0.006)
      break
    }
    case 'neck': fillAll(c, id, ID_RED); web(c, 28, 4, 0.14); break
    case 'head': {
      fillAll(c, id, ID_RED)
      web(c, 40, 9, 0.16)
      // face relief under the mask (bump only): brow ridge, eye sockets, nose ridge, cheekbones, mouth line, chin
      metric(c, c.relief, 0.25, () => {
        const r = c.relief
        const blob = (x: number, y: number, rx: number, ry: number, v: number) => {
          r.save(); r.translate(x, y); r.scale(rx, ry)
          const g = r.createRadialGradient(0, 0, 0, 0, 0, 1)
          g.addColorStop(0, `rgba(${v},${v},${v},0.9)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`)
          r.fillStyle = g; r.beginPath(); r.arc(0, 0, 1, 0, Math.PI * 2); r.fill(); r.restore()
        }
        for (const sx of [1, -1]) {
          blob(sx * 0.0365, 0.055 + 0.055, 0.03, 0.02, 55)        // eye sockets (deeper)
          blob(sx * 0.045, 0.02 + 0.055, 0.03, 0.022, 175)        // cheekbones
        }
        blob(0, 0.03 + 0.055, 0.011, 0.04, 230)                   // nose ridge
        blob(0, 0.0 + 0.055, 0.016, 0.012, 205)                   // nose tip
        blob(0, -0.027 + 0.055, 0.03, 0.006, 60)                  // mouth line
        blob(0, -0.045 + 0.055, 0.02, 0.012, 190)                 // chin
        blob(0, 0.085 + 0.055, 0.06, 0.008, 170)                  // brow ridge
      })
      break
    }
    case 'arm': {
      // top = shoulder (v=1), bottom = elbow. Left arm orientation: outer u=.5, inner u=0/1.
      fillAll(c, id, ID_RED)
      wrapped(c, id, 0, () => { rect(id, -0.05, 0, 0.05, 0.33, ID_BLK); rect(id, -0.053, 0, -0.049, 0.33, ID_GLD); rect(id, 0.049, 0, 0.053, 0.33, ID_GLD) })
      wrapped(c, id, 0.5, () => { rect(id, -0.011, 0, 0.011, 0.33, ID_GLD) })
      band(c, id, 0.29, 0.33, ID_BLK); band(c, id, 0.285, 0.292, ID_GLD)
      band(c, id, 0.05, 0.062, ID_GLD)
      web(c, 26, 12, 0.14)
      glowRect(c, 0.5, 0, 0.24, 0.007, 0.03)
      break
    }
    case 'forearm': {
      // slice from elbow (v=1) to wrist (v=0). gold bracer over the lower ~45 %
      fillAll(c, id, ID_RED)
      wrapped(c, id, 0, () => { rect(id, -0.035, 0.11, 0.035, 0.275, ID_BLK); rect(id, -0.038, 0.11, -0.034, 0.275, ID_GLD); rect(id, 0.034, 0.11, 0.038, 0.275, ID_GLD) })
      band(c, id, 0, 0.125, ID_GLD)
      band(c, id, 0.025, 0.04, ID_BLK); band(c, id, 0.085, 0.1, ID_BLK)
      web(c, 22, 9, 0.14, 0.42)
      c.glow.fillStyle = '#fff'; c.glow.fillRect(0, H - (0.07 / hgt) * H, W, (0.008 / hgt) * H)
      break
    }
    case 'hand': { fillAll(c, id, ID_RED); band(c, id, 0.165, 0.18, ID_GLD); web(c, 20, 8, 0.15); break }
    case 'thigh': {
      fillAll(c, id, ID_BLK)
      wrapped(c, id, 0.5, () => { rect(id, -0.006, 0, 0.006, 0.55, ID_GLD) })
      wrapped(c, id, 0, () => { rect(id, -0.004, 0.05, 0.004, 0.55, ID_GLD) })
      id.strokeStyle = ID_GLD; id.lineWidth = 1
      for (let i = 1; i < 8; i++) { id.globalAlpha = 0.5; id.beginPath(); id.moveTo(0, (i / 8) * H); id.lineTo(W, (i / 8) * H); id.stroke() }
      id.globalAlpha = 1
      band(c, id, 0, 0.02, ID_GLD)
      break
    }
    case 'shin': {
      // slice y=.48 (top) … .075 (bottom). Red boot below y≈.24 (0.4 of slice), gold cuff band at top of the boot.
      fillAll(c, id, ID_BLK)
      wrapped(c, id, 0.5, () => { rect(id, -0.005, 0.17, 0.005, 0.41, ID_GLD) })
      const bootTop = 0.165
      band(c, id, 0, bootTop, ID_RED)
      band(c, id, bootTop, bootTop + 0.034, ID_GLD); band(c, id, bootTop + 0.008, bootTop + 0.026, ID_BLK)
      // kneecap plate outline
      metric(c, id, 0.25, () => { id.strokeStyle = ID_GLD; id.lineWidth = 0.004; id.beginPath(); id.ellipse(0, 0.375, 0.045, 0.035, 0, 0, Math.PI * 2); id.stroke() })
      web(c, 26, 10, 0.14, 0.6)
      // web only on the red boot: crop by drawing a black rect over the upper part of the web canvas
      c.web.fillStyle = '#000'; c.web.fillRect(0, 0, W, H * (1 - bootTop / hgt) - 0)
      c.web.strokeStyle = '#fff'
      break
    }
    case 'foot': { fillAll(c, id, ID_RED); band(c, id, 0, 0.012, ID_GLD); web(c, 22, 8, 0.14); break }
  }

  return compose(c, kind)
}

function compose(c: Ctxs, kind: PaintKind): SuitTex {
  const { W, H } = c
  const idd = c.id.getImageData(0, 0, W, H).data
  const wbd = c.web.getImageData(0, 0, W, H).data
  const rld = c.relief.getImageData(0, 0, W, H).data
  const gld = c.glow.getImageData(0, 0, W, H).data
  const map = mk(W, H), orm = mk(W, H), em = mk(W, H), bump = mk(W, H)
  const mi = map.createImageData(W, H), oi = orm.createImageData(W, H), ei = em.createImageData(W, H), bi = bump.createImageData(W, H)
  const R = [0xc8, 0x1d, 0x25], K = [0x0d, 0x10, 0x16], G = [0xb9, 0x95, 0x45]
  const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const x = i % W, y = (i / W) | 0
    let wr = idd[p] / 255, wk = idd[p + 1] / 255, wg = idd[p + 2] / 255
    const sum = wr + wk + wg || 1; wr /= sum; wk /= sum; wg /= sum
    const web = wbd[p] / 255 * (wr > 0.35 ? 1 : 0)
    const n = hash(x, y)
    // fabric micro-pattern on black: tiny diagonal weave
    const weave = wk > 0.5 ? (((x + y) & 3) === 0 ? 1 : 0) * 0.55 + n * 0.25 : 0
    let r = R[0] * wr + K[0] * wk + G[0] * wg, g = R[1] * wr + K[1] * wk + G[1] * wg, b = R[2] * wr + K[2] * wk + G[2] * wg
    const shade = 1 - web * 0.5 + (n - 0.5) * 0.05 + weave * 0.35
    r *= shade; g *= shade; b *= shade
    mi.data[p] = r; mi.data[p + 1] = g; mi.data[p + 2] = b; mi.data[p + 3] = 255
    // ORM: G = roughness, B = metalness
    const rough = 0.3 * wr + 0.62 * wk + 0.36 * wg + (wg > 0.5 ? (hash(x * 0.05, y) - 0.5) * 0.12 : 0) + weave * 0.15
    const metal = 0.42 * wr + 0.05 * wk + 0.93 * wg
    oi.data[p] = 255; oi.data[p + 1] = Math.min(255, rough * 255); oi.data[p + 2] = Math.min(255, metal * 255); oi.data[p + 3] = 255
    const gv = gld[p] / 255
    ei.data[p] = 120 * gv; ei.data[p + 1] = 220 * gv; ei.data[p + 2] = 255 * gv; ei.data[p + 3] = 255
    const h = 128 + (rld[p] - 128) * 0.5 + (n - 0.5) * 10 - web * 58 + weave * 18 + wg * (hash(x * 0.03, y * 1.3) - 0.5) * 14
    bi.data[p] = bi.data[p + 1] = bi.data[p + 2] = h; bi.data[p + 3] = 255
  }
  map.putImageData(mi, 0, 0); orm.putImageData(oi, 0, 0); em.putImageData(ei, 0, 0); bump.putImageData(bi, 0, 0)
  const tex = (ctx: CanvasRenderingContext2D, srgb: boolean) => {
    const t = new THREE.CanvasTexture(ctx.canvas)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping
    t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter
    t.needsUpdate = true
    return t
  }
  void kind
  return { map: tex(map, true), orm: tex(orm, false), emissive: tex(em, true), bump: tex(bump, false) }
}

export function disposeSuitTex(t: SuitTex) { t.map.dispose(); t.orm.dispose(); t.emissive.dispose(); t.bump.dispose() }
