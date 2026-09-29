import { describe, it, expect } from 'vitest'
import { NanotechController } from '../src/transformation/NanotechController'
import { SUIT_PARTS } from '../src/character/rigSpec'

const run = (c: NanotechController, sec: number, dt = 1 / 60) => { for (let t = 0; t < sec; t += dt) c.update(dt) }
const allParts = (c: NanotechController, v: number) => SUIT_PARTS.every((p) => c.progress[p] === v)

describe('NanotechController', () => {
  it('suit up completes in ~2.5 s with all regions revealed', () => {
    const c = new NanotechController()
    expect(c.dispatch('SUIT_TOGGLE')).toBe('accepted')
    run(c, 2.4); expect(c.phase).toBe('SUIT_UP')
    run(c, 0.2)
    expect(c.phase).toBe('IDLE'); expect(c.form).toBe('SPIDER'); expect(c.mask).toBe('MASK_CLOSED'); expect(allParts(c, 1)).toBe(true)
  })
  it('follows the spec order: chest before arms before legs before mask', () => {
    const c = new NanotechController(); c.dispatch('SUIT_UP')
    const first: Record<string, number> = {}
    let t = 0
    while (c.phase !== 'IDLE') { c.update(1 / 120); t += 1 / 120; for (const p of SUIT_PARTS) if (c.progress[p] > 0.05 && first[p] === undefined) first[p] = t }
    expect(first.Chest).toBeLessThan(first.Arm_L); expect(first.Arm_L).toBeLessThan(first.Thigh_L)
    expect(first.Thigh_L).toBeLessThan(first.Shin_L); expect(first.Shin_L).toBeLessThan(first.Foot_L); expect(first.Foot_L).toBeLessThan(first.Neck)
    expect(first.Neck).toBeLessThan(first.Head)
  })
  it('locks conflicting commands during a transformation', () => {
    const c = new NanotechController(); c.dispatch('SUIT_UP'); run(c, 0.5)
    expect(c.dispatch('SUIT_DOWN')).toBe('ignored'); expect(c.dispatch('SUIT_TOGGLE')).toBe('ignored')
    expect(c.dispatch('MASK_TOGGLE')).toBe('ignored'); expect(c.dispatch('ARMS_TOGGLE')).toBe('ignored')
    expect(c.phase).toBe('SUIT_UP')
  })
  it('mask and arms only work in spider form', () => {
    const c = new NanotechController()
    expect(c.dispatch('MASK_TOGGLE')).toBe('ignored'); expect(c.dispatch('ARMS_TOGGLE')).toBe('ignored')
  })
  it('mask open/close cycle', () => {
    const c = new NanotechController(); c.dispatch('SUIT_UP'); run(c, 3)
    expect(c.dispatch('MASK_TOGGLE')).toBe('accepted'); expect(c.mask).toBe('MASK_OPENING'); expect(c.headMix).toBe(0)
    run(c, 1); expect(c.mask).toBe('MASK_OPEN'); expect(c.progress.Head).toBe(0)
    c.dispatch('MASK_TOGGLE'); run(c, 1); expect(c.mask).toBe('MASK_CLOSED'); expect(c.progress.Head).toBe(1)
  })
  it('queues a mask toggle that arrives mid-transition and runs it afterwards', () => {
    const c = new NanotechController(); c.dispatch('SUIT_UP'); run(c, 3)
    c.dispatch('MASK_OPEN'); run(c, 0.2)
    expect(c.dispatch('MASK_CLOSE')).toBe('queued'); run(c, 3)
    expect(c.mask).toBe('MASK_CLOSED')
  })
  it('suit down auto-retracts deployed arms first', () => {
    const c = new NanotechController(); c.dispatch('SUIT_UP'); run(c, 3)
    c.dispatch('ARMS_DEPLOY'); run(c, 2.5); expect(c.arms).toBe('ARMS_DEPLOYED')
    expect(c.dispatch('SUIT_DOWN')).toBe('accepted'); expect(c.arms).toBe('ARMS_RETRACTING')
    run(c, 6)
    expect(c.form).toBe('CIVILIAN'); expect(c.arms).toBe('ARMS_RETRACTED'); expect(allParts(c, 0)).toBe(true)
  })
  it('reverse order: mask → neck → arms → chest → legs', () => {
    const c = new NanotechController(); c.dispatch('SUIT_UP'); run(c, 3); c.dispatch('SUIT_DOWN')
    const gone: Record<string, number> = {}; let t = 0
    while (c.phase !== 'IDLE') { c.update(1 / 120); t += 1 / 120; for (const p of SUIT_PARTS) if (c.progress[p] < 0.95 && gone[p] === undefined) gone[p] = t }
    expect(gone.Head).toBeLessThan(gone.Neck); expect(gone.Neck).toBeLessThan(gone.Arm_L); expect(gone.Arm_L).toBeLessThan(gone.Chest); expect(gone.Chest).toBeLessThan(gone.Thigh_L)
  })
  it('QA: 100 consecutive suit up/down cycles leave a clean state (no deadlock, no drift)', () => {
    const c = new NanotechController()
    for (let i = 0; i < 100; i++) {
      expect(c.dispatch('SUIT_TOGGLE')).toBe('accepted'); run(c, 3)
      expect(c.form).toBe('SPIDER'); expect(allParts(c, 1)).toBe(true)
      expect(c.dispatch('SUIT_TOGGLE')).toBe('accepted'); run(c, 3)
      expect(c.form).toBe('CIVILIAN'); expect(allParts(c, 0)).toBe(true); expect(c.phase).toBe('IDLE')
    }
    expect(c.queued.length).toBe(0); expect(c.core).toBe(0); expect(c.flow).toBe(0)
  })
  it('QA: random command fuzz never deadlocks and always ends in a valid state', () => {
    const c = new NanotechController(); let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const cmds = ['SUIT_TOGGLE', 'MASK_TOGGLE', 'ARMS_TOGGLE', 'SUIT_DOWN', 'SUIT_UP', 'MASK_OPEN', 'ARMS_RETRACT'] as const
    for (let i = 0; i < 400; i++) { c.dispatch(cmds[Math.floor(rnd() * cmds.length)]); run(c, rnd() * 0.9) }
    run(c, 10)
    expect(c.busy).toBe(false); expect(c.queued.length).toBe(0)
    for (const p of SUIT_PARTS) expect([0, 1]).toContain(c.progress[p])
  })
  it('emits lifecycle events once', () => {
    const c = new NanotechController(); const ev: string[] = []; c.onAny((e) => ev.push(e))
    c.dispatch('SUIT_UP'); run(c, 3)
    expect(ev.filter((e) => e === 'core')).toHaveLength(1)
    expect(ev[0]).toBe('suitUpStart'); expect(ev[ev.length - 1]).toBe('suitUpComplete')
  })
})
