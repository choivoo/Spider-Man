import { describe, it, expect } from 'vitest'
import { pickLOD } from '../src/character/lod'
import { scoreDevice, PRESETS } from '../src/quality/quality'
import { goalsFor } from '../src/spiderArms/armPoses'
import { twoBoneIK } from '../src/spiderArms/SpiderArmIK'
import * as THREE from 'three'

describe('LOD selection', () => {
  const cfg = { lodBias: 0, maxLod: 2 }
  it('gets coarser with distance and has hysteresis', () => {
    expect(pickLOD(1, 0, cfg)).toBe(0)
    expect(pickLOD(4.7, 0, cfg)).toBe(1)
    expect(pickLOD(9, 1, cfg)).toBe(2)
    // just below the threshold does not flip back immediately
    expect(pickLOD(3.05, 1, cfg)).toBe(1)
    expect(pickLOD(2.4, 1, cfg)).toBe(0)
  })
  it('respects maxLod', () => expect(pickLOD(20, 0, { lodBias: 0, maxLod: 1 })).toBe(1))
})

describe('device scoring', () => {
  it('software rendering → LOW', () => expect(scoreDevice({ memory: 8, cores: 8, mobile: false, screenPx: 2e6, gpu: 'Google SwiftShader' }).tier).toBe('LOW'))
  it('desktop RTX → HIGH or better', () => expect(['HIGH', 'ULTRA']).toContain(scoreDevice({ memory: 8, cores: 16, mobile: false, screenPx: 4e6, gpu: 'NVIDIA GeForce RTX 4070' }).tier))
  it('budget phone → LOW/MEDIUM, never ULTRA', () => {
    const r = scoreDevice({ memory: 2, cores: 4, mobile: true, screenPx: 3e6, gpu: 'Mali-G52' })
    expect(['LOW', 'MEDIUM']).toContain(r.tier)
  })
  it('presets match spec particle budgets', () => {
    expect(PRESETS.ULTRA.particles).toBeGreaterThanOrEqual(10000); expect(PRESETS.HIGH.particles).toBe(5000)
    expect(PRESETS.MEDIUM.particles).toBe(2000); expect(PRESETS.LOW.particles).toBeGreaterThanOrEqual(500); expect(PRESETS.LOW.particles).toBeLessThanOrEqual(1500)
  })
})

describe('spider arm IK', () => {
  it('reaches reachable targets exactly and keeps segment lengths', () => {
    const base = new THREE.Vector3(0, 0, 0), target = new THREE.Vector3(0.5, 0.3, 0.4)
    const r = twoBoneIK(base, 0.5, 0.46, target, new THREE.Vector3(0, 1, 0))
    expect(r.wrist.distanceTo(target)).toBeLessThan(1e-6)
    expect(r.elbow.distanceTo(base)).toBeCloseTo(0.5, 5)
    expect(r.elbow.distanceTo(r.wrist)).toBeCloseTo(0.46, 5)
  })
  it('clamps unreachable targets without NaN', () => {
    const r = twoBoneIK(new THREE.Vector3(), 0.5, 0.46, new THREE.Vector3(5, 5, 5), new THREE.Vector3(0, 1, 0))
    expect(r.clamped).toBe(true); expect(Number.isFinite(r.elbow.x + r.elbow.y + r.elbow.z)).toBe(true)
  })
  it('every mode gives four mirrored goals', () => {
    for (const m of ['IDLE', 'DEFENSE', 'ATTACK', 'BALANCE', 'POSE'] as const) {
      const g = goalsFor(m); expect(g).toHaveLength(4)
      expect(g[0].wrist.x).toBeCloseTo(-g[1].wrist.x, 6); expect(g[2].wrist.x).toBeCloseTo(-g[3].wrist.x, 6)
    }
  })
})
