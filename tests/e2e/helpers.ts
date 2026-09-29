import { expect, type Page } from '@playwright/test'

export async function boot(page: Page, opts: { speed?: number } = {}) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForFunction(() => (window as any).__spider?.director?.anim, null, { timeout: 60_000 })
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 60_000 })
  if (opts.speed) await page.evaluate((s) => { (window as any).__spider.nano.speed = s }, opts.speed)
  return errors
}

export const suitState = (page: Page) => page.evaluate(() => {
  const n = (window as any).__spider.nano
  return { form: n.form, phase: n.phase, mask: n.mask, arms: n.arms, label: n.label(false) }
})

/** count visible suit / civilian meshes in the scene (duplicate-mesh and missing-body checks) */
export const meshCensus = (page: Page) => page.evaluate(() => {
  const scene = (window as any).__spider.scene
  let suit = 0, civ = 0, all = 0
  scene.traverse((o: any) => {
    if (!o.isMesh) return
    all++
    if (!o.visible) return
    let v = true; for (let p = o.parent; p; p = p.parent) if (!p.visible) { v = false; break }
    if (!v) return
    const m = Array.isArray(o.material) ? o.material[0] : o.material
    if (o.userData.isSuit) suit++; else if (m?.userData?.nanoPart) civ++
  })
  return { suit, civ, all }
})
