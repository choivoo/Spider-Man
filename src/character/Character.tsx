import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { buildRig } from './ProceduralRig'
import { buildCivilian } from './Civilian'
import { buildSuit } from './SpiderSuit'
import { director } from './director'
import { nano, publishSuitStatus } from '../transformation'
import { partUniforms, globalNano } from '../transformation/nanoMaterial'
import { SUIT_PARTS, type SuitPartName } from './rigSpec'

export default function Character() {
  const model = useMemo(() => {
    const rig = buildRig()
    const civ = buildCivilian(rig)
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
    return { rig, civ, suit, civByPart, suitByPart }
  }, [])
  const { gl } = useThree()

  useEffect(() => {
    director.attachRig(model.rig)
    const onMove = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      director.look.pointerNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
    }
    window.addEventListener('pointermove', onMove)
    return () => { window.removeEventListener('pointermove', onMove); director.detachRig(); model.civ.dispose(); model.suit.dispose() }
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
    model.suit.eyes.update(director.eyeExpression, Math.max(fs.Blink_L, fs.Blink_R), look.eyeYaw, look.eyePitch, nano.eyes, dt)
    const coreMat = model.suit.core.material as THREE.MeshBasicMaterial
    const pulse = 0.8 + Math.sin(clock.elapsedTime * 6) * 0.2
    coreMat.opacity = Math.min(1, nano.core * 1.2)
    model.suit.core.visible = nano.core > 0.01
    model.suit.core.scale.setScalar((0.6 + nano.core * 1.4) * pulse)
    model.suit.coreLight.intensity = nano.core * 2.2 * pulse
  })
  return <primitive object={model.rig.root} />
}
