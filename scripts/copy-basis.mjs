// Copies the KTX2 (Basis) + Draco decoders from three.js into /public so texture/mesh compression works offline.
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const from = path.join(root, 'node_modules/three/examples/jsm/libs')
const pairs = [['basis', 'public/basis'], ['draco/gltf', 'public/draco']]
for (const [src, dst] of pairs) {
  const s = path.join(from, src), d = path.join(root, dst)
  if (!fs.existsSync(s)) { console.warn('[copy-basis] missing', s); continue }
  fs.mkdirSync(d, { recursive: true })
  for (const f of fs.readdirSync(s)) fs.copyFileSync(path.join(s, f), path.join(d, f))
}
console.log('[copy-basis] decoders ready')
