import { Environment, Lightformer, ContactShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useCharacterStore } from '../store/characterStore'

/** Minimal 3D room: warm in Civilian mode, slightly cooler in Spider mode. Lightformer environment → no network fetch. */
export default function Room() {
  const key = useRef<THREE.DirectionalLight>(null)
  const rim = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.HemisphereLight>(null)
  const warm = new THREE.Color('#ffd9b0'), cool = new THREE.Color('#bcd6ff')
  const tmp = useRef(new THREE.Color())
  const t = useRef(0)
  useFrame((_, dt) => {
    const spider = 0 // wired to suit progress in 0.5+
    t.current += (spider - t.current) * Math.min(1, dt * 3)
    tmp.current.copy(warm).lerp(cool, t.current)
    key.current?.color.copy(tmp.current)
    fill.current?.color.copy(tmp.current)
    void useCharacterStore
  })
  return (
    <>
      <color attach="background" args={['#14161c']} />
      <fog attach="fog" args={['#14161c', 8, 18]} />
      <hemisphereLight ref={fill} args={['#ffe6cc', '#20232b', 0.55]} />
      <directionalLight ref={key} position={[2.4, 3.6, 3.2]} intensity={2.4} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={3} shadow-camera-bottom={-1} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <directionalLight ref={rim} position={[-3, 2.6, -2.5]} intensity={2.2} color="#9cc4ff" />
      <directionalLight position={[-2.5, 1.2, 3]} intensity={0.7} color="#ffe3c8" />
      <Environment resolution={128} background={false} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 3, 3]} scale={[6, 2, 1]} color="#fff1dd" />
        <Lightformer form="rect" intensity={1.6} position={[-4, 1.5, 0]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} color="#cfe2ff" />
        <Lightformer form="rect" intensity={1.2} position={[4, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} color="#ffe2c4" />
        <Lightformer form="ring" intensity={1.2} position={[0, 4, -3]} scale={3} color="#ffffff" />
      </Environment>
      {/* floor + back wall */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[9, 64]} />
        <meshStandardMaterial color="#262932" roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.2, -3.2]}>
        <planeGeometry args={[14, 5]} />
        <meshStandardMaterial color="#1b1e26" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.06, -3.19]}>
        <boxGeometry args={[14, 0.12, 0.03]} />
        <meshStandardMaterial color="#12141a" roughness={0.6} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} opacity={0.55} scale={5} blur={2.4} far={2.2} resolution={512} />
    </>
  )
}
