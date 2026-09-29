import * as THREE from 'three'

export type MatKind = 'skin' | 'hair' | 'blazer' | 'lapel' | 'tee' | 'pants' | 'shoe' | 'sole' | 'lace' | 'button'
  | 'sclera' | 'iris' | 'pupil' | 'lip' | 'mouth' | 'teeth' | 'brow' | 'lid'

import { patchNano } from '../transformation/nanoMaterial'
import type { SuitPartName } from './rigSpec'

const cache = new Map<string, THREE.Material>()

/** Small tileable fabric-ish normal map generated once (cheap, avoids asset dependency). */
let fabricNormal: THREE.Texture | null = null
export function getFabricNormal(): THREE.Texture {
  if (fabricNormal) return fabricNormal
  const s = 128
  const c = document.createElement('canvas'); c.width = c.height = s
  const g = c.getContext('2d')!
  const img = g.createImageData(s, s)
  // height = woven diagonal pattern + noise, converted to normal
  const h = new Float32Array(s * s)
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const w = Math.sin((x + y) * 0.9) * Math.sin((x - y) * 0.9)
    h[y * s + x] = w * 0.5 + (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * 0.35
  }
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = h[y * s + ((x + 1) % s)] - h[y * s + ((x + s - 1) % s)]
    const dy = h[((y + 1) % s) * s + x] - h[((y + s - 1) % s) * s + x]
    const i = (y * s + x) * 4
    img.data[i] = 128 + dx * 40; img.data[i + 1] = 128 + dy * 40; img.data[i + 2] = 255; img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  fabricNormal = new THREE.CanvasTexture(c)
  fabricNormal.wrapS = fabricNormal.wrapT = THREE.RepeatWrapping
  fabricNormal.repeat.set(6, 6)
  return fabricNormal
}

const PALETTE = {
  skin: '#e6b99c', hair: '#3a2417', blazer: '#2a2d34', lapel: '#1b1d23', tee: '#101115', pants: '#1f2228',
  shoe: '#060607', sole: '#0a0a0b', lace: '#111114', button: '#0a0a0a',
}

export function makeMaterial(kind: MatKind, part?: SuitPartName, opts: { double?: boolean } = {}): THREE.Material {
  const key = `${kind}|${part ?? ''}|${opts.double ? 'd' : ''}`
  const hit = cache.get(key)
  if (hit) return hit
  let m: THREE.Material
  switch (kind) {
    case 'skin':
      m = new THREE.MeshPhysicalMaterial({ color: PALETTE.skin, roughness: 0.62, metalness: 0, sheen: 0.6, sheenColor: new THREE.Color('#ffb59a'), sheenRoughness: 0.5 })
      break
    case 'hair':
      m = new THREE.MeshStandardMaterial({ color: PALETTE.hair, roughness: 0.48, metalness: 0.05 })
      break
    case 'blazer':
      m = new THREE.MeshStandardMaterial({ color: PALETTE.blazer, roughness: 0.88, normalMap: getFabricNormal(), normalScale: new THREE.Vector2(0.2, 0.2) })
      break
    case 'lapel':
      m = new THREE.MeshStandardMaterial({ color: PALETTE.lapel, roughness: 0.42, metalness: 0.05 })
      break
    case 'tee':
      m = new THREE.MeshStandardMaterial({ color: PALETTE.tee, roughness: 0.95 })
      break
    case 'pants':
      m = new THREE.MeshStandardMaterial({ color: PALETTE.pants, roughness: 0.92, normalMap: getFabricNormal(), normalScale: new THREE.Vector2(0.12, 0.12) })
      break
    case 'shoe':
      m = new THREE.MeshPhysicalMaterial({ color: PALETTE.shoe, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15 })
      break
    case 'sole':
      m = new THREE.MeshStandardMaterial({ color: PALETTE.sole, roughness: 0.6 })
      break
    case 'lace':
      m = new THREE.MeshStandardMaterial({ color: PALETTE.lace, roughness: 0.5 })
      break
    case 'button':
      m = new THREE.MeshStandardMaterial({ color: PALETTE.button, roughness: 0.3, metalness: 0.3 })
      break
    case 'sclera':
      m = new THREE.MeshStandardMaterial({ color: '#f3efe9', roughness: 0.25 })
      break
    case 'iris':
      m = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.3 })
      break
    case 'pupil':
      m = new THREE.MeshBasicMaterial({ color: '#050303' })
      break
    case 'lip':
      m = new THREE.MeshStandardMaterial({ color: '#b56b62', roughness: 0.5 })
      break
    case 'mouth':
      m = new THREE.MeshBasicMaterial({ color: '#2a0d10', side: THREE.DoubleSide })
      break
    case 'teeth':
      m = new THREE.MeshStandardMaterial({ color: '#f4f0e8', roughness: 0.4, side: THREE.DoubleSide })
      break
    case 'brow':
      m = new THREE.MeshStandardMaterial({ color: '#2c1a10', roughness: 0.7 })
      break
    case 'lid':
      m = new THREE.MeshStandardMaterial({ color: PALETTE.skin, roughness: 0.6 })
      break
  }
  if (opts.double) m.side = THREE.DoubleSide
  if (part) patchNano(m, part, true)
  cache.set(key, m)
  return m
}

export function disposeMaterialCache() {
  cache.forEach((m) => m.dispose())
  cache.clear()
}
