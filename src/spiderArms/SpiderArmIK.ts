import * as THREE from 'three'

/**
 * Analytic two-bone IK (law of cosines) with a pole vector. Used for the spider arms' two long segments;
 * the claw is oriented separately. Works in any consistent space.
 */
export interface IKResult { elbow: THREE.Vector3; wrist: THREE.Vector3; reach: number; clamped: boolean }

const tmp = { d: new THREE.Vector3(), n: new THREE.Vector3(), p: new THREE.Vector3(), b: new THREE.Vector3() }

export function twoBoneIK(base: THREE.Vector3, l1: number, l2: number, target: THREE.Vector3, pole: THREE.Vector3, out?: IKResult): IKResult {
  const res = out ?? { elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), reach: 0, clamped: false }
  const d = tmp.d.copy(target).sub(base)
  let dist = d.length()
  const minD = Math.abs(l1 - l2) + 0.02, maxD = l1 + l2 - 0.001
  res.clamped = dist > maxD || dist < minD
  dist = Math.min(maxD, Math.max(minD, dist))
  if (d.lengthSq() < 1e-9) d.set(0, 0, -1)
  d.normalize()
  // distance along the base→target axis to the elbow's projection, and its height off the axis
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  // bend direction = pole component perpendicular to the axis
  const p = tmp.p.copy(pole)
  p.addScaledVector(d, -p.dot(d))
  if (p.lengthSq() < 1e-8) p.set(0, 1, 0).addScaledVector(d, -d.y)
  if (p.lengthSq() < 1e-8) p.set(1, 0, 0)
  p.normalize()
  res.elbow.copy(base).addScaledVector(d, a).addScaledVector(p, h)
  res.wrist.copy(base).addScaledVector(d, dist)
  res.reach = dist
  return res
}

/** Critically-damped scalar/vector smoothing (frame-rate independent). */
export function smoothVec(cur: THREE.Vector3, target: THREE.Vector3, dt: number, rate = 9) {
  const k = 1 - Math.exp(-rate * dt)
  cur.lerp(target, k)
}

/** Basis whose Y axis is `dir` and whose Z axis leans toward `curl` — used to orient the curved claw. */
export function clawBasis(dir: THREE.Vector3, curl: THREE.Vector3, out = new THREE.Quaternion()) {
  const y = tmp.b.copy(dir).normalize()
  const z = tmp.n.copy(curl).addScaledVector(y, -curl.dot(y))
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(y, -y.z)
  z.normalize()
  const x = new THREE.Vector3().crossVectors(y, z)
  const m = new THREE.Matrix4().makeBasis(x, y.clone(), z.clone())
  return out.setFromRotationMatrix(m)
}
