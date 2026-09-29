import * as THREE from 'three'
import type { LODMesh } from './loft'
import type { QualityConfig } from '../quality/quality'

/** Distance thresholds (metres) between LOD0 → LOD1 → LOD2 for the character. */
export const LOD_DISTANCES = [3.0, 6.5]

/** Pure level selection with hysteresis so meshes don't flicker at a threshold. */
export function pickLOD(distance: number, current: number, cfg: Pick<QualityConfig, 'lodBias' | 'maxLod'>): number {
  const h = 0.12
  let level = current
  const t = LOD_DISTANCES.map((d) => d / (1 + cfg.lodBias * 0.35))
  // move up (coarser) / down (finer) only when clearly past a threshold
  for (let i = 0; i < t.length; i++) {
    if (level <= i && distance > t[i] * (1 + h)) level = i + 1
    if (level > i && distance < t[i] * (1 - h)) level = i
  }
  return Math.min(level, cfg.maxLod)
}

export class LODManager {
  level = 0
  private tmp = new THREE.Vector3()
  update(camera: THREE.Camera, target: THREE.Object3D, meshes: LODMesh[][], cfg: QualityConfig, extra?: (level: number) => void): boolean {
    target.getWorldPosition(this.tmp)
    const d = camera.position.distanceTo(this.tmp)
    const next = pickLOD(d, this.level, cfg)
    if (next === this.level) return false
    this.level = next
    for (const group of meshes) for (const m of group) m.setLOD(next)
    extra?.(next)
    return true
  }
}
