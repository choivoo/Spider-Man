import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

/** 0.1 placeholder human — replaced by the procedural rig in 0.2. */
function PlaceholderHuman() {
  const black = <meshStandardMaterial color="#15171c" roughness={0.6} />
  return (
    <group>
      <mesh position={[0, 1.66, 0]}><sphereGeometry args={[0.11, 32, 24]} /><meshStandardMaterial color="#e2b9a0" /></mesh>
      <mesh position={[0, 1.2, 0]}><capsuleGeometry args={[0.17, 0.5, 8, 16]} />{black}</mesh>
      <mesh position={[-0.09, 0.5, 0]}><capsuleGeometry args={[0.07, 0.75, 8, 12]} />{black}</mesh>
      <mesh position={[0.09, 0.5, 0]}><capsuleGeometry args={[0.07, 0.75, 8, 12]} />{black}</mesh>
      <mesh position={[-0.24, 1.15, 0]}><capsuleGeometry args={[0.05, 0.5, 8, 12]} />{black}</mesh>
      <mesh position={[0.24, 1.15, 0]}><capsuleGeometry args={[0.05, 0.5, 8, 12]} />{black}</mesh>
    </group>
  )
}

export default function Stage() {
  return (
    <Canvas camera={{ position: [0, 1.2, 4.2], fov: 32 }} dpr={[1, 2]}>
      <color attach="background" args={['#0b0d12']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 3]} intensity={2} />
      <PlaceholderHuman />
      <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[3, 48]} /><meshStandardMaterial color="#1a1d24" /></mesh>
      <OrbitControls target={[0, 1.05, 0]} enablePan={false} minDistance={1.5} maxDistance={7} />
    </Canvas>
  )
}
