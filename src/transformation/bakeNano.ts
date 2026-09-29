import * as THREE from 'three'
import { BONES, type BoneName, type SuitPartName } from '../character/rigSpec'
import type { Rig } from '../character/ProceduralRig'
import { nanoOrder } from './nanoOrder'
import { LODMesh } from '../character/loft'

/**
 * Give every patched mesh its reveal-order attributes (aNano / aNano2) computed from the vertex position in
 * rest-pose world space. Works for lofts, primitives, LOD geometries and InstancedMesh (per-instance).
 * Shared geometries are cloned first so left/right copies get their own values.
 */
export function bakeNanoForTree(rig: Rig) {
  rig.root.updateMatrixWorld(true)
  const boneSet = new Set<THREE.Object3D>(BONES.map((b) => rig.bones[b]))
  const boneOf = (o: THREE.Object3D): BoneName | null => {
    for (let c: THREE.Object3D | null = o.parent; c; c = c.parent) if (boneSet.has(c)) return c.name as BoneName
    return null
  }
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4(), v = new THREE.Vector3()
  rig.root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!(mesh as { isMesh?: boolean }).isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const part = mats.map((m) => m.userData?.nanoPart as SuitPartName | undefined).find(Boolean)
    if (!part) return
    const bone = boneOf(mesh)
    if (!bone) return
    const fn = nanoOrder(part, bone)
    inv.copy(rig.bones[bone].matrixWorld).invert()
    rel.multiplyMatrices(inv, mesh.matrixWorld)

    const bake = (g: THREE.BufferGeometry, matrix: THREE.Matrix4) => {
      const pos = g.getAttribute('position') as THREE.BufferAttribute
      const a = new Float32Array(pos.count), b = new Float32Array(pos.count)
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(matrix)
        const r = fn(v.x, v.y, v.z)
        a[i] = r[0]; b[i] = r[1]
      }
      g.setAttribute('aNano', new THREE.BufferAttribute(a, 1))
      g.setAttribute('aNano2', new THREE.BufferAttribute(b, 1))
    }

    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const im = mesh as THREE.InstancedMesh
      const a = new Float32Array(im.count), b = new Float32Array(im.count)
      const m4 = new THREE.Matrix4()
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m4); v.setFromMatrixPosition(m4).applyMatrix4(rel)
        const r = fn(v.x, v.y, v.z); a[i] = r[0]; b[i] = r[1]
      }
      im.geometry = im.geometry.clone()
      im.geometry.setAttribute('aNano', new THREE.InstancedBufferAttribute(a, 1))
      im.geometry.setAttribute('aNano2', new THREE.InstancedBufferAttribute(b, 1))
      return
    }
    if (mesh instanceof LODMesh) {
      // LOD geometries are authored in bone space, and `rel` is identity for direct children of the bone
      for (const g of mesh.levels) bake(g, rel)
      return
    }
    mesh.geometry = mesh.geometry.clone()
    bake(mesh.geometry, rel)
  })
}
