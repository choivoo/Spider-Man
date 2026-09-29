import { useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { buildRig } from './ProceduralRig'
import { buildCivilian } from './Civilian'
import { buildSuit } from './SpiderSuit'
import { director } from './director'
import { nano, publishSuitStatus } from '../transformation'
import { partUniforms, globalNano } from '../transformation/nanoMaterial'
import { NanoParticles } from '../transformation/NanoParticles'
import { useQuality } from '../quality/quality'
import { useBoot } from '../boot'
import { fx } from './SpiderFX'
import { SpiderArms } from '../spiderArms/SpiderArms'
import { POSE_CROUCH } from '../animation/poses'
import { LODMesh } from './loft'
import { LODManager } from './lod'
import type { ExternalCharacter } from './glbAdapter'
import { SUIT_PARTS, type SuitPartName } from './rigSpec'

/** Loads an optional drop-in GLB (/models/character.glb); otherwise uses the procedural character. */
export default function Character() {
  const gl = useThree((s) => s.gl)
  const [ext, setExt] = useState<ExternalCharacter | null | undefined>(undefined)
  useEffect(() => {
    let dead = false
    // the GLB adapter (and its Draco/KTX2/Meshopt loaders) is only fetched when needed
    import('./glbAdapter').then((m) => m.loadExternalCharacter(gl)).then((e) => { if (!dead) setExt(e) }).catch(() => { if (!dead) setExt(null) })
    return () => { dead = true }
  }, [gl])
  if (ext === undefined) return null
  return <CharacterInner ext={ext} />
}

function CharacterInner({ ext }: { ext: ExternalCharacter | null }) {
  const model = useMemo(() => {
    const rig = ext ? ext.rig : buildRig()
    const civ = ext
      ? { group: new THREE.Group(), face: ext.face, lodMeshes: [] as LODMesh[], hairInstanced: null as unknown as THREE.InstancedMesh, dispose: () => ext.dispose() }
      : buildCivilian(rig)
    const suit = buildSuit(rig, 1)
    // group meshes for cheap visibility switching
    const civByPart = Object.fromEntries(SUIT_PARTS.map((p) => [p, [] as THREE.Object3D[]])) as Record<SuitPartName, THREE.Object3D[]>
    const suitByPart = suit.meshesByPart
    rig.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material
      const part = mat?.userData?.nanoPart as SuitPartName | undefined
      if (part && !m.userData.isSuit) civByPart[part].push(m)
    })
    const particles = new NanoParticles(rig, useQuality.getState().config.particles)
    // inverted-hull outline for the spider-sense pulse (one cheap mesh per LOD mesh, hidden until needed)
    const outlineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.4, 0.35), side: THREE.BackSide, toneMapped: false, transparent: true, opacity: 0.9 })
    const outlineU = { value: 0.012 }
    outlineMat.onBeforeCompile = (sh) => {
      sh.uniforms.uOutline = outlineU
      sh.vertexShader = 'uniform float uOutline;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normal * uOutline;')
    }
    const outlines: { src: THREE.Mesh; out: THREE.Mesh }[] = []
    rig.root.traverse((o) => {
      if (o instanceof LODMesh && !/Sole|Skin_/.test(o.name)) {
        const out = new THREE.Mesh(o.levels[Math.min(1, o.levels.length - 1)], outlineMat)
        out.visible = false; out.renderOrder = -1
        o.parent!.add(out); outlines.push({ src: o, out })
      }
    })
    const arms = new SpiderArms(rig, useQuality.getState().config.armSegments)
    const lod = new LODManager()
    return { rig, civ, suit, civByPart, suitByPart, particles, outlines, outlineU, arms, lod }
  }, [ext])
  const { gl, size, viewport } = useThree()

  useEffect(() => {
    director.attachRig(model.rig)
    useBoot.getState().mark('character')
    const onMove = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      director.look.pointerNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
    }
    window.addEventListener('pointermove', onMove)
    return () => { window.removeEventListener('pointermove', onMove); director.detachRig(); model.civ.dispose(); model.suit.dispose(); model.particles.dispose(); model.arms.dispose() }
  }, [model, gl])

  useFrame(({ camera, clock }, dt) => {
    globalNano.uTime.value = clock.elapsedTime
    nano.update(dt)
    publishSuitStatus()

    // per-part reveal → shader uniforms + visibility
    for (const p of SUIT_PARTS) {
      const pr = nano.progress[p]
      const pu = partUniforms(p)
      pu.uReveal.value = pr
      if (p === 'Head') pu.uMix.value = nano.headMix
      const sv = pr > 0.0005, cv = pr < 0.9995
      for (const m of model.suitByPart[p]) m.visible = sv
      for (const m of model.civByPart[p]) m.visible = cv
    }
    // the civilian face is only shown while the mask is off
    director.anim?.setStance(nano.formBlend > 0.4 ? 'spider' : 'civilian')

    director.update(dt, camera)
    const look = director.look.out
    model.civ.face.setGaze(look.eyeYaw, look.eyePitch)
    model.civ.face.update(director.face.state)

    // suit face + glow
    const fs = director.face.state
    model.suit.eyes.update(director.eyeExpression, Math.max(fs.Blink_L, fs.Blink_R), look.eyeYaw, look.eyePitch, Math.min(1.6, nano.eyes * (1 + fx.senseFlare * 0.8)) * (nano.eyes > 0.02 ? 1 : 0), dt)
    const coreMat = model.suit.core.material as THREE.MeshBasicMaterial
    const pulse = 0.8 + Math.sin(clock.elapsedTime * 6) * 0.2
    coreMat.opacity = Math.min(1, nano.core * 1.2)
    model.suit.core.visible = nano.core > 0.01
    model.suit.core.scale.setScalar((0.6 + nano.core * 1.4) * pulse)
    model.suit.coreLight.intensity = nano.core * 2.2 * pulse
    const cam = camera as THREE.PerspectiveCamera
    model.lod.update(camera, model.rig.root, [model.civ.lodMeshes, model.suit.lodMeshes], useQuality.getState().config, (l) => model.arms.setLOD(l))
    model.arms.setMode(nano.armsMode)
    model.arms.update(dt, nano.armsProgress, fx.senseFlare)
    if (director.anim) director.anim.extra = nano.armsMode === 'BALANCE' && nano.arms === 'ARMS_DEPLOYED' ? POSE_CROUCH : {}
    // spider-sense outline pulse
    const on = fx.outline > 0.02
    model.outlineU.value = 0.004 + fx.outline * 0.012
    for (const { src, out } of model.outlines) out.visible = on && src.visible
    model.particles.update(clock.elapsedTime, nano.flow, (p) => nano.particleProgress(p), size.height * viewport.dpr, cam.fov)
  })
  return (
    <>
      <primitive object={model.rig.root} />
      <primitive object={model.particles.points} />
    </>
  )
}
