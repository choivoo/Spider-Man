import * as THREE from 'three'
import { BONES, BONE_DEF, REST_EULER, type BoneName } from './rigSpec'

export interface Rig {
  root: THREE.Group
  bones: Record<BoneName, THREE.Object3D>
  restQuat: Record<BoneName, THREE.Quaternion>
  restPos: Record<BoneName, THREE.Vector3>
}

/** Builds the shared skeleton. The civilian body, the suit and any imported GLB all bind to these bone names. */
export function buildRig(): Rig {
  const root = new THREE.Group()
  root.name = 'CharacterRoot'
  const bones = {} as Record<BoneName, THREE.Object3D>
  const restQuat = {} as Record<BoneName, THREE.Quaternion>
  const restPos = {} as Record<BoneName, THREE.Vector3>
  const skeleton = new THREE.Group(); skeleton.name = 'Skeleton'
  root.add(skeleton)
  for (const name of BONES) {
    const b = new THREE.Object3D()
    b.name = name
    const def = BONE_DEF[name]
    b.position.set(...def.pos)
    const e = REST_EULER[name]
    if (e) b.rotation.set(e[0], e[1], e[2])
    bones[name] = b
    restQuat[name] = b.quaternion.clone()
    restPos[name] = b.position.clone()
    ;(def.parent === 'root' ? skeleton : bones[def.parent as BoneName]).add(b)
  }
  return { root, bones, restQuat, restPos }
}
