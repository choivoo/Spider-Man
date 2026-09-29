import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { BONES, BONE_ALIASES, type BoneName, type SuitPartName } from './rigSpec'
import type { Rig } from './ProceduralRig'
import { patchNano } from '../transformation/nanoMaterial'
import { nanoOrder } from '../transformation/nanoOrder'
import { restWorldPos } from './rigSpec'
import { partFromName } from './Civilian'
import type { FaceState } from '../animation/faceTypes'
import { log } from '../log'

/**
 * Drop-in GLB / VRM character support (spec §37, §65).
 * Put a humanoid at /models/character.glb — see docs/MODELING_GUIDE.md for the required proportions
 * (feet at y=0, ~1.78 m tall, facing +Z) and mesh naming. The adapter:
 *   1. binds the GLB's skeleton to our bone names (Mixamo / VRM / Rigify names supported),
 *   2. gives every material the nano reveal shader according to its mesh name,
 *   3. maps ARKit/VRM-style morph targets to the FaceState blendshapes,
 * so animation, look-at, lip-sync, the nano transformation and the spider arms all work unchanged.
 * NOTE: verified against a GLB exported from the procedural rig; not yet against third-party production assets.
 */

export interface FaceView { setGaze(yaw: number, pitch: number): void; update(f: FaceState | null): void }
export interface ExternalCharacter { rig: Rig; face: FaceView; dispose(): void; gltf: { animations: THREE.AnimationClip[] } }

const norm = (s: string) => s.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/g, '')

export function bindBones(root: THREE.Object3D): { bones: Partial<Record<BoneName, THREE.Object3D>>; missing: BoneName[] } {
  const byName = new Map<string, THREE.Object3D>()
  root.traverse((o) => { byName.set(norm(o.name), o) })
  const bones: Partial<Record<BoneName, THREE.Object3D>> = {}
  const missing: BoneName[] = []
  for (const b of BONES) {
    const hit = BONE_ALIASES[b].map(norm).map((a) => byName.get(a)).find(Boolean) ?? byName.get(norm(b))
    if (hit) bones[b] = hit; else missing.push(b)
  }
  return { bones, missing }
}

/** Morph target names (ARKit / VRM / spec) → FaceState channels. */
const MORPH_MAP: Record<string, (f: FaceState) => number> = {
  blink_l: (f) => f.Blink_L, blink_r: (f) => f.Blink_R, eyeblinkleft: (f) => f.Blink_L, eyeblinkright: (f) => f.Blink_R, blinkleft: (f) => f.Blink_L, blinkright: (f) => f.Blink_R,
  smile_l: (f) => f.Smile_L, smile_r: (f) => f.Smile_R, mouthsmileleft: (f) => f.Smile_L, mouthsmileright: (f) => f.Smile_R, smile: (f) => (f.Smile_L + f.Smile_R) / 2, happy: (f) => (f.Smile_L + f.Smile_R) / 2,
  mouthopen: (f) => Math.max(f.MouthOpen, f.mouth.open), jawopen: (f) => Math.max(f.MouthOpen, f.mouth.open), aa: (f) => f.visemes.AA, viseme_aa: (f) => f.visemes.AA, a: (f) => f.visemes.AA,
  ih: (f) => f.visemes.IH, viseme_ih: (f) => f.visemes.IH, i: (f) => f.visemes.IH, ou: (f) => f.visemes.OU, viseme_ou: (f) => f.visemes.OU, u: (f) => f.visemes.OU,
  ee: (f) => f.visemes.EE, viseme_ee: (f) => f.visemes.EE, e: (f) => f.visemes.EE, oh: (f) => f.visemes.OH, viseme_oh: (f) => f.visemes.OH, o: (f) => f.visemes.OH,
  viseme_ch: (f) => f.visemes.CH, viseme_ff: (f) => f.visemes.FV, viseme_fv: (f) => f.visemes.FV, viseme_pp: (f) => f.visemes.M, viseme_m: (f) => f.visemes.M, viseme_l: (f) => f.visemes.L,
  browup: (f) => f.BrowUp, browinnerup: (f) => f.BrowUp, browdown: (f) => f.BrowDown, browdownleft: (f) => f.BrowDown, browdownright: (f) => f.BrowDown,
  surprise: (f) => f.Surprise, surprised: (f) => f.Surprise, angry: (f) => f.Angry, sad: (f) => f.Sad, squint: (f) => f.Squint, eyesquintleft: (f) => f.Squint, eyesquintright: (f) => f.Squint,
}

export function morphFaceView(root: THREE.Object3D): FaceView {
  const targets: { mesh: THREE.Mesh; index: number; get: (f: FaceState) => number }[] = []
  const eyes: THREE.Object3D[] = []
  root.traverse((o) => {
    if (/^(lefteye|righteye|eye_?l|eye_?r|j_adj_[lr]_faceeye)$/i.test(o.name)) eyes.push(o)
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.morphTargetDictionary) return
    for (const [name, index] of Object.entries(m.morphTargetDictionary)) {
      const get = MORPH_MAP[name.toLowerCase().replace(/[^a-z_0-9]/g, '')] as ((f: FaceState) => number) | undefined
      if (get) targets.push({ mesh: m, index, get })
    }
  })
  return {
    setGaze(yaw, pitch) { for (const e of eyes) e.rotation.set(-pitch, yaw, 0) },
    update(f) {
      if (!f) return
      for (const t of targets) if (t.mesh.morphTargetInfluences) t.mesh.morphTargetInfluences[t.index] = Math.min(1, Math.max(0, t.get(f)))
    },
  }
}

export function createLoader(gl?: THREE.WebGLRenderer) {
  const loader = new GLTFLoader()
  const draco = new DRACOLoader().setDecoderPath('/draco/')
  loader.setDRACOLoader(draco)
  loader.setMeshoptDecoder(MeshoptDecoder)
  if (gl) { const ktx = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl); loader.setKTX2Loader(ktx) }
  return loader
}

/** Look for /models/character.glb (verifies the GLB magic bytes — SPA hosts return index.html for unknown paths). */
export async function loadExternalCharacter(gl?: THREE.WebGLRenderer, url = '/models/character.glb'): Promise<ExternalCharacter | null> {
  let buf: ArrayBuffer
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    buf = await r.arrayBuffer()
    if (new DataView(buf).getUint32(0, true) !== 0x46546c67) return null // 'glTF'
  } catch { return null }
  try {
    const gltf = await createLoader(gl).parseAsync(buf, '/models/')
    return adaptGLTF(gltf.scene, gltf.animations)
  } catch (e) {
    log.error('glb.load', { message: String((e as Error).message).slice(0, 160) })
    return null
  }
}

export function adaptGLTF(scene: THREE.Object3D, animations: THREE.AnimationClip[] = []): ExternalCharacter | null {
  const { bones, missing } = bindBones(scene)
  const required: BoneName[] = ['hips', 'head', 'upperArmL', 'upperArmR', 'thighL', 'thighR']
  if (required.some((b) => missing.includes(b))) { log.warn('glb.bones.missing', { missing: missing.join(',') }); return null }
  scene.updateMatrixWorld(true)
  // fill optional bones (chest, clavicles, neck…) with pass-through nodes so the controller can address every name
  const full = {} as Record<BoneName, THREE.Object3D>
  for (const b of BONES) {
    if (bones[b]) { full[b] = bones[b]!; continue }
    const dummy = new THREE.Object3D(); dummy.name = `${b}_virtual`
    const parentGuess = b.startsWith('clavicle') ? bones.chest ?? bones.spine ?? bones.hips! : b === 'neck' ? bones.chest ?? bones.hips! : bones.hips!
    parentGuess.add(dummy); full[b] = dummy
  }
  const rig: Rig = {
    root: scene as THREE.Group,
    bones: full,
    restQuat: Object.fromEntries(BONES.map((b) => [b, full[b].quaternion.clone()])) as Rig['restQuat'],
    restPos: Object.fromEntries(BONES.map((b) => [b, full[b].position.clone()])) as Rig['restPos'],
  }
  // materials → nano reveal by mesh name; baked from bind-pose world positions
  const hips = restWorldPos('hips')
  const disposables: THREE.Material[] = []
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const part = partFromName(m.name) as SuitPartName
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => { const c = mat.clone(); disposables.push(c); return c })
    m.material = Array.isArray(m.material) ? mats : mats[0]
    for (const mat of mats) patchNano(mat, part, true)
    const fn = nanoOrder(part, 'hips')
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute
    const a = new Float32Array(pos.count), b = new Float32Array(pos.count), v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); const r = fn(v.x - hips[0], v.y - hips[1], v.z - hips[2]); a[i] = r[0]; b[i] = r[1] }
    m.geometry = m.geometry.clone()
    m.geometry.setAttribute('aNano', new THREE.BufferAttribute(a, 1)); m.geometry.setAttribute('aNano2', new THREE.BufferAttribute(b, 1))
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false
  })
  return { rig, face: morphFaceView(scene), gltf: { animations }, dispose() { disposables.forEach((d) => d.dispose()) } }
}
