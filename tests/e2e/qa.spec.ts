import { test, expect } from '@playwright/test'
import { boot, meshCensus } from './helpers'

const CYCLES = Number(process.env.QA_CYCLES ?? 25)

/** Spec §50: repeated Suit Up / Suit Down must not leak or corrupt state. (`QA_CYCLES=100` for the full run.) */
test(`transformation QA: ${CYCLES} consecutive suit up / down cycles`, async ({ page }) => {
  test.setTimeout(30 * 60_000)
  await boot(page, { speed: 60 })
  const snap = () => page.evaluate(() => {
    const s = (window as any).__spider, gl = s.gl
    let objects = 0; s.scene.traverse(() => objects++)
    return { geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, programs: gl.info.programs.length, objects, heap: (performance as any).memory?.usedJSHeapSize ?? 0 }
  })
  // warm-up: one full cycle so lazily created programs exist
  const cycle = async (up: boolean) => {
    await page.evaluate(() => (window as any).__spider.command('SUIT_TOGGLE'))
    await page.waitForFunction((want) => { const n = (window as any).__spider.nano; return n.phase === 'IDLE' && n.form === want }, up ? 'SPIDER' : 'CIVILIAN', { timeout: 60_000 })
    // let the render loop apply the new state (visibility switch) before we inspect the scene
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r())))))
  }
  await cycle(true); await cycle(false)
  const before = await snap()
  for (let i = 0; i < CYCLES; i++) {
    await cycle(true)
    const c = await meshCensus(page)
    expect(c.civ, `cycle ${i}: civilian meshes should be hidden in spider form`).toBe(0)
    await cycle(false)
    const d = await meshCensus(page)
    expect(d.suit, `cycle ${i}: suit meshes should be hidden in civilian form`).toBe(0)
  }
  const after = await snap()
  expect(after.geometries).toBe(before.geometries)   // no geometry leak / duplicate meshes
  expect(after.textures).toBe(before.textures)
  expect(after.programs).toBe(before.programs)       // shader reset never recompiles
  expect(after.objects).toBe(before.objects)         // no duplicated scene objects
  // skeleton sanity: no NaN, still anchored on the ground
  const ok = await page.evaluate(() => { const r = (window as any).__spider.director.anim.rig; return Object.values(r.bones).every((b: any) => Number.isFinite(b.position.x + b.quaternion.w)) && Math.abs(r.bones.footL.getWorldPosition(new (r.bones.footL.position.constructor)()).y - 0.075) < 0.08 })
  expect(ok).toBe(true)
  console.log(`[QA] ${CYCLES} cycles ok`, JSON.stringify({ before, after }))
})

/** Spec §51: 30 s of arms + particles + chat + suit toggling must not grow memory. */
test('performance QA: 30 s combined load without leaks', async ({ page }) => {
  test.setTimeout(10 * 60_000)
  await boot(page, { speed: 4 })
  const heap = () => page.evaluate(() => { const s = (window as any).__spider; return { heap: (performance as any).memory?.usedJSHeapSize ?? 0, geo: s.gl.info.memory.geometries, tex: s.gl.info.memory.textures } })
  await page.evaluate(() => (window as any).__spider.command('SUIT_UP'))
  await page.waitForFunction(() => (window as any).__spider.nano.form === 'SPIDER', null, { timeout: 90_000 })
  await page.evaluate(() => { const s = (window as any).__spider; s.command('ARMS_DEPLOY') })
  await page.waitForTimeout(3000)
  const h0 = await heap()
  const t0 = Date.now(); let i = 0
  while (Date.now() - t0 < 30_000) {
    await page.evaluate((k) => { const s = (window as any).__spider; const modes = ['DEFENSE', 'ATTACK', 'BALANCE', 'POSE', 'IDLE']; s.nano.setArmsMode(modes[k % 5]); if (k % 3 === 0) s.triggerSpiderSense(); if (k % 4 === 0) s.director.gesture(['wave', 'nod', 'shrug'][k % 3]) }, i++)
    await page.fill('.chat-input input', `테스트 메시지 ${i}`)
    await page.click('.chat-input button[type=submit]')
    await page.waitForTimeout(1500)
  }
  const h1 = await heap()
  console.log('[QA] 30s combined', JSON.stringify({ h0, h1, frames: i }))
  expect(h1.geo).toBe(h0.geo); expect(h1.tex).toBe(h0.tex)
  if (h0.heap) expect(h1.heap - h0.heap).toBeLessThan(60 * 1024 * 1024) // generous: GC noise, but no runaway growth
})
