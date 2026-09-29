import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { buildRig } from './ProceduralRig'
import { buildCivilian } from './Civilian'
import { director } from './director'

export default function Character() {
  const model = useMemo(() => {
    const rig = buildRig()
    const civ = buildCivilian(rig)
    return { rig, civ }
  }, [])
  const { gl } = useThree()

  useEffect(() => {
    director.attachRig(model.rig)
    const onMove = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      director.look.pointerNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
    }
    window.addEventListener('pointermove', onMove)
    return () => { window.removeEventListener('pointermove', onMove); director.detachRig(); model.civ.dispose() }
  }, [model, gl])

  useFrame(({ camera }, dt) => {
    director.update(dt, camera)
    const look = director.look.out
    model.civ.face.setGaze(look.eyeYaw, look.eyePitch)
    model.civ.face.update(director.face.state)
  })
  return <primitive object={model.rig.root} />
}
