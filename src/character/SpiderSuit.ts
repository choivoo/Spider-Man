import * as THREE from 'three'
import { buildLoftLOD, buildLoft, LODMesh, LOD_SETTINGS, sliceProfile, shiftY, type Section } from './loft'
import { TORSO, ARM, LEG, NECK, HEAD, SHOE } from './profiles'
import { buildHandLOD } from './Civilian'
import { paintSuit, disposeSuitTex, type PaintKind, type SuitTex } from './suitTextures'
import { restWorldY, SUIT_PARTS, type BoneName, type SuitPartName } from './rigSpec'
import { patchNano } from '../transformation/nanoMaterial'
import { bakeNanoForTree } from '../transformation/bakeNano'
import type { Rig } from './ProceduralRig'
import { SpiderEyes } from './SpiderEyes'

export interface SuitModel {
  eyes: SpiderEyes
  core: THREE.Mesh
  coreLight: THREE.PointLight
  emblemGlow: THREE.MeshBasicMaterial
  meshesByPart: Record<SuitPartName, THREE.Mesh[]>
  lodMeshes: LODMesh[]
  /** mesh that hosts the mask "cover" the spider arms rise from (0.7) */
  backPlate: THREE.Group
  dispose(): void
}

const SUIT_T = 0.006

export function buildSuit(rig: Rig, texScale = 1): SuitModel {
  const lodMeshes: LODMesh[] = []
  const meshesByPart = Object.fromEntries(SUIT_PARTS.map((p) => [p, [] as THREE.Mesh[]])) as Record<SuitPartName, THREE.Mesh[]>
  const texCache = new Map<PaintKind, SuitTex>()
  const tex = (k: PaintKind) => { if (!texCache.has(k)) texCache.set(k, paintSuit(k, texScale)); return texCache.get(k)! }
  const wy = (b: BoneName) => restWorldY(b)

  const texMat = (kind: PaintKind, part: SuitPartName) => {
    const t = tex(kind)
    const red = kind === 'head' || kind === 'neck' || kind === 'hand' || kind === 'arm'
    const m = new THREE.MeshPhysicalMaterial({
      map: t.map, roughnessMap: t.orm, metalnessMap: t.orm, emissiveMap: t.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.6,
      bumpMap: t.bump, bumpScale: 1.6, roughness: 1, metalness: 1, clearcoat: red ? 0.35 : 0.15, clearcoatRoughness: 0.35,
    })
    m.userData.suit = true
    patchNano(m, part, false)
    return m
  }
  const solid = (kind: 'gold' | 'black' | 'cyan', part: SuitPartName) => {
    let m: THREE.Material
    if (kind === 'gold') m = new THREE.MeshPhysicalMaterial({ color: '#b99545', metalness: 0.95, roughness: 0.3, clearcoat: 0.2, envMapIntensity: 1.3 })
    else if (kind === 'black') m = new THREE.MeshStandardMaterial({ color: '#0d1016', metalness: 0.5, roughness: 0.42 })
    else m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.6, 2.2), toneMapped: false })
    m.userData.suit = true
    patchNano(m, part, false)
    return m
  }

  const addLoft = (bone: BoneName, part: SuitPartName, secs: Section[], material: THREE.Material, o: { rings?: number; capTop?: boolean; capBottom?: boolean; uvV?: [number, number]; mirror?: boolean; name: string }) => {
    const geos = buildLoftLOD(secs, { ringsBase: o.rings ?? 16, capTop: o.capTop, capBottom: o.capBottom, uvV: o.uvV, mirrorU: o.mirror })
    const m = new LODMesh(geos, material)
    m.name = o.name; m.castShadow = true; m.receiveShadow = true; m.userData.isSuit = true
    rig.bones[bone].add(m); lodMeshes.push(m); meshesByPart[part].push(m)
    return m
  }
  const addMesh = (bone: BoneName, part: SuitPartName, geo: THREE.BufferGeometry, material: THREE.Material, name: string, parent?: THREE.Object3D) => {
    const m = new THREE.Mesh(geo, material); m.name = name; m.castShadow = true; m.userData.isSuit = true
    ;(parent ?? rig.bones[bone]).add(m); meshesByPart[part].push(m)
    return m
  }
  const T = (y0: number, y1: number, n: number, d: number) => sliceProfile(TORSO, y0, y1, n, () => d)

  // ------------- torso -------------
  addLoft('hips', 'Waist', shiftY(T(0.86, 1.07, 6, SUIT_T), wy('hips')), texMat('waist', 'Waist'), { name: 'Suit_Pelvis', capBottom: true, uvV: [0, (1.07 - 0.86) / 0.38] })
  addLoft('spine', 'Waist', shiftY(T(1.055, 1.212, 6, SUIT_T), wy('spine')), texMat('waist', 'Waist'), { name: 'Suit_Abdomen', uvV: [(1.055 - 0.86) / 0.38, (1.212 - 0.86) / 0.38] })
  addLoft('chest', 'Chest', shiftY(T(1.2, 1.49, 9, SUIT_T + 0.0015), wy('chest')), texMat('chest', 'Chest'), { name: 'Suit_Chest', capTop: true, rings: 20 })
  addLoft('neck', 'Neck', shiftY(sliceProfile(NECK, 1.42, 1.58, 5, () => SUIT_T), wy('neck')), texMat('neck', 'Neck'), { name: 'Suit_Neck', rings: 8 })
  addLoft('head', 'Head', HEAD.map((s) => ({ ...s, rx: s.rx + 0.005, rz: s.rz + 0.005 })), texMat('head', 'Head'), { name: 'Suit_Mask', rings: 26, capTop: true, capBottom: true })

  // ------------- limbs -------------
  for (const side of ['L', 'R'] as const) {
    const mirror = side === 'R'
    const S = (p: string) => `${p}_${side}` as SuitPartName
    addLoft(`upperArm${side}` as BoneName, S('Arm'), sliceProfile(ARM, 0.032, -0.3, 8, () => SUIT_T - 0.001), texMat('arm', S('Arm')), { name: `Suit_UpperArm_${side}`, capTop: true, mirror, uvV: [(-0.3 + 0.3) / 0.33, 1] })
    addLoft(`foreArm${side}` as BoneName, S('Forearm'), shiftY(sliceProfile(ARM, -0.27, -0.545, 8, () => SUIT_T - 0.001), -0.285), texMat('forearm', S('Forearm')), { name: `Suit_ForeArm_${side}`, mirror })
    const hg = buildHandLOD(side, 0.0035)
    const hand = new LODMesh(hg, texMat('hand', S('Hand'))); hand.name = `Suit_Hand_${side}`; hand.castShadow = true; hand.userData.isSuit = true
    rig.bones[`hand${side}` as BoneName].add(hand); lodMeshes.push(hand); meshesByPart[S('Hand')].push(hand)
    addLoft(`thigh${side}` as BoneName, S('Thigh'), sliceProfile(LEG, 0.10, -0.45, 10, () => SUIT_T - 0.002), texMat('thigh', S('Thigh')), { name: `Suit_Thigh_${side}`, mirror })
    addLoft(`shin${side}` as BoneName, S('Shin'), shiftY(sliceProfile(LEG, -0.43, -0.835, 10, () => SUIT_T - 0.002), -0.44), texMat('shin', S('Shin')), { name: `Suit_Shin_${side}`, mirror, uvV: [0, 1] })
    // boot / foot
    const sec: Section[] = SHOE.map((s) => ({ y: s.z, rx: s.hw + 0.004, rz: s.hh + 0.004, cz: -s.cy, n: 2.6 }))
    const geos = LOD_SETTINGS.map((l) => { const g = buildLoft(sec, { radial: l.radial, rings: Math.max(6, Math.round(16 * l.ringScale)), capTop: true, capBottom: true, mirrorU: mirror }); g.rotateX(Math.PI / 2); return g })
    const foot = new LODMesh(geos, texMat('foot', S('Foot'))); foot.name = `Suit_Foot_${side}`; foot.castShadow = true; foot.userData.isSuit = true
    rig.bones[`foot${side}` as BoneName].add(foot); lodMeshes.push(foot); meshesByPart[S('Foot')].push(foot)

    // ------------- armour add-ons (Reference B) -------------
    const sx = side === 'L' ? 1 : -1
    // pauldron
    const paul = new THREE.SphereGeometry(0.062, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2)
    paul.scale(1.0, 0.5, 1.08)
    const pm = addMesh(`clavicle${side}` as BoneName, S('Shoulder'), paul, solid('gold', S('Shoulder')), `Suit_Pauldron_${side}`)
    pm.position.set(sx * 0.14, 0.018, 0); pm.rotation.z = sx * -0.42
    const rim = new THREE.TorusGeometry(0.058, 0.0035, 8, 32); rim.rotateX(Math.PI / 2)
    const rm = addMesh(`clavicle${side}` as BoneName, S('Shoulder'), rim, solid('black', S('Shoulder')), `Suit_PauldronRim_${side}`)
    rm.position.set(sx * 0.14, 0.018, 0); rm.rotation.z = sx * -0.42
    const led = addMesh(`clavicle${side}` as BoneName, S('Shoulder'), new THREE.BoxGeometry(0.03, 0.004, 0.012), solid('cyan', S('Shoulder')), `Suit_ShoulderLED_${side}`)
    led.position.set(sx * 0.15, 0.052, 0.02); led.rotation.z = sx * -0.42
    // bracer (gold ring on the wrist section with a cyan strip)
    const bracer = sliceProfile(ARM, -0.415, -0.52, 6, () => SUIT_T + 0.0055)
    addLoft(`foreArm${side}` as BoneName, S('Forearm'), shiftY(bracer, -0.285), solid('gold', S('Forearm')), { name: `Suit_Bracer_${side}`, rings: 8 })
    const bled = new THREE.TorusGeometry(0.0305, 0.0016, 6, 28); bled.rotateX(Math.PI / 2)
    const bl = addMesh(`foreArm${side}` as BoneName, S('Forearm'), bled, solid('cyan', S('Forearm')), `Suit_BracerLED_${side}`)
    bl.position.set(0, -0.2, 0.0)
    // knee plate
    const kg = new THREE.SphereGeometry(0.05, 20, 14); kg.scale(0.95, 1.15, 0.5)
    const km = addMesh(`shin${side}` as BoneName, S('Shin'), kg, solid('black', S('Shin')), `Suit_KneePlate_${side}`)
    km.position.set(0, 0.012, 0.052)
    const kr = new THREE.TorusGeometry(0.048, 0.0028, 6, 30); kr.scale(0.95, 1.15, 1)
    const krm = addMesh(`shin${side}` as BoneName, S('Shin'), kr, solid('gold', S('Shin')), `Suit_KneeRim_${side}`)
    krm.position.set(0, 0.012, 0.0655)
  }

  // belt buckle
  {
    const g = new THREE.CylinderGeometry(0.03, 0.03, 0.008, 6); g.rotateX(Math.PI / 2)
    const b = addMesh('hips', 'Waist', g, solid('gold', 'Waist'), 'Suit_Buckle')
    b.position.set(0, 1.055 - wy('hips'), 0.112); b.rotation.z = Math.PI / 6
    const g2 = new THREE.CylinderGeometry(0.017, 0.017, 0.01, 6); g2.rotateX(Math.PI / 2)
    const b2 = addMesh('hips', 'Waist', g2, solid('cyan', 'Waist'), 'Suit_BuckleLED')
    b2.position.set(0, 1.055 - wy('hips'), 0.115); b2.rotation.z = Math.PI / 6
  }

  // back plate (spider-arm housing, see SpiderArms)
  const backPlate = new THREE.Group(); backPlate.name = 'BackPlate'
  {
    const shape = new THREE.Shape()
    const w = 0.15, h = 0.115, r = 0.035
    shape.moveTo(-w + r, -h); shape.lineTo(w - r, -h); shape.quadraticCurveTo(w, -h, w, -h + r); shape.lineTo(w, h - r); shape.quadraticCurveTo(w, h, w - r, h)
    shape.lineTo(-w + r, h); shape.quadraticCurveTo(-w, h, -w, h - r); shape.lineTo(-w, -h + r); shape.quadraticCurveTo(-w, -h, -w + r, -h)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 10 })
    const plate = addMesh('chest', 'Back', geo, solid('black', 'Back'), 'Suit_BackPlate', backPlate)
    plate.rotation.y = Math.PI
    for (const [x, y] of [[-0.085, 0.06], [0.085, 0.06], [-0.085, -0.05], [0.085, -0.05]]) {
      const tg = new THREE.TorusGeometry(0.024, 0.006, 8, 24)
      const t = addMesh('chest', 'Back', tg, solid('gold', 'Back'), 'Suit_ArmSocket', backPlate)
      t.position.set(x, y, -0.03)
    }
    const led = addMesh('chest', 'Back', new THREE.BoxGeometry(0.1, 0.006, 0.004), solid('cyan', 'Back'), 'Suit_BackLED', backPlate)
    led.position.set(0, -0.098, -0.028)
    backPlate.position.set(0, 1.315 - wy('chest'), -0.117)
    rig.bones.chest.add(backPlate)
  }

  // nano core (chest, over the emblem) + light
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 2.6), toneMapped: false, transparent: true, opacity: 0 })
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), coreMat)
  core.position.set(0, 1.33 - wy('chest'), 0.125); core.renderOrder = 5
  rig.bones.chest.add(core)
  const coreLight = new THREE.PointLight('#8fe4ff', 0, 1.2, 2)
  coreLight.position.copy(core.position).add(new THREE.Vector3(0, 0, 0.08))
  rig.bones.chest.add(coreLight)
  const emblemGlow = coreMat

  // eyes
  const eyes = new SpiderEyes()
  rig.bones.head.add(eyes.group)

  bakeNanoForTree(rig)

  const dispose = () => {
    lodMeshes.forEach((m) => m.disposeAll())
    texCache.forEach(disposeSuitTex)
    eyes.dispose()
  }
  return { eyes, core, coreLight, emblemGlow, meshesByPart, lodMeshes, backPlate, dispose }
}
