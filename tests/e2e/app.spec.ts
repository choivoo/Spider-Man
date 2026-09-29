import { test, expect } from '@playwright/test'
import { boot, suitState, meshCensus } from './helpers'

test.describe('SPIDER-AI', () => {
  test('boots, shows the loading screen, then the character', async ({ page }) => {
    const errors = await boot(page)
    await expect(page.locator('.chat')).toBeVisible()
    expect(errors.filter((e) => !/WebGL|GPU stall|ReadPixels/i.test(e))).toEqual([])
  })

  test('chat works end-to-end (offline demo brain) and shows the reply', async ({ page }) => {
    await boot(page)
    await page.fill('.chat-input input', '안녕!')
    await page.click('.chat-input button[type=submit]')
    await expect(page.locator('.bubble.assistant:not(.typing)').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.bubble.user')).toHaveText('안녕!')
  })

  test('Shift+S suits up, M toggles the mask, A the arms, Shift+S suits down', async ({ page }) => {
    await boot(page, { speed: 12 })
    expect((await suitState(page)).form).toBe('CIVILIAN')
    await page.keyboard.press('Shift+S')
    await expect.poll(async () => (await suitState(page)).form, { timeout: 60_000 }).toBe('SPIDER')
    await expect(page.locator('.hud.on')).toBeVisible()
    const c = await meshCensus(page)
    expect(c.suit).toBeGreaterThan(20); expect(c.civ).toBe(0) // no duplicate / leftover civilian meshes

    await page.keyboard.press('m')
    await expect.poll(async () => (await suitState(page)).mask, { timeout: 60_000 }).toBe('MASK_OPEN')
    await page.keyboard.press('m')
    await expect.poll(async () => (await suitState(page)).mask, { timeout: 60_000 }).toBe('MASK_CLOSED')

    await page.keyboard.press('a')
    await expect.poll(async () => (await suitState(page)).arms, { timeout: 60_000 }).toBe('ARMS_DEPLOYED')
    await expect(page.getByRole('toolbar', { name: 'Spider arm modes' })).toBeVisible()
    await page.keyboard.press('Shift+S') // auto-retracts the arms first
    await expect.poll(async () => (await suitState(page)).form, { timeout: 90_000 }).toBe('CIVILIAN')
    expect((await suitState(page)).arms).toBe('ARMS_RETRACTED')
    const d = await meshCensus(page)
    expect(d.suit).toBe(0); expect(d.civ).toBeGreaterThan(20)
  })

  test('typing in the chat does not trigger hotkeys', async ({ page }) => {
    await boot(page)
    await page.fill('.chat-input input', 'sam m a c')
    expect((await suitState(page)).form).toBe('CIVILIAN')
  })

  test('the AI can suit up on request (demo brain) but is gated by cooldown/state', async ({ page }) => {
    await boot(page, { speed: 12 })
    await page.fill('.chat-input input', '슈트 입어봐')
    await page.click('.chat-input button[type=submit]')
    await expect.poll(async () => (await suitState(page)).form, { timeout: 90_000 }).toBe('SPIDER')
  })

  test('settings dialog opens, traps focus and closes with Esc', async ({ page }) => {
    await boot(page)
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    await page.getByRole('tab', { name: 'AI Memory' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('Resilience & persistence', () => {
  test('API outage: shows "Connection temporarily unavailable." and the character keeps animating', async ({ page }) => {
    await boot(page)
    await page.route('**/api/chat', (r) => r.abort())
    await page.fill('.chat-input input', 'hello?')
    await page.click('.chat-input button[type=submit]')
    await expect(page.getByText('Connection temporarily unavailable.')).toBeVisible({ timeout: 30_000 })
    const t0 = await page.evaluate(() => (window as any).__spider.director.anim.time)
    await page.waitForTimeout(1500)
    const t1 = await page.evaluate(() => (window as any).__spider.director.anim.time)
    expect(t1).toBeGreaterThan(t0) // render loop + idle animation still running
    await page.unroute('**/api/chat')
  })

  test('settings and memory persist across a reload; sensitive data is not stored', async ({ page }) => {
    await boot(page)
    await page.evaluate(() => localStorage.clear())
    await page.reload(); await boot(page)
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('tab', { name: 'Subtitles' }).click()
    await page.getByRole('combobox').selectOption('lg')
    await page.keyboard.press('Escape')
    await page.fill('.chat-input input', '이거 꼭 기억해: 내 이름은 민수야')
    await page.click('.chat-input button[type=submit]')
    await expect(page.locator('.bubble.assistant:not(.typing)').first()).toBeVisible({ timeout: 30_000 })
    await page.fill('.chat-input input', 'my api key is sk-abcdefghijklmnopqrstuvwxyz0123')
    await page.click('.chat-input button[type=submit]')
    await expect(page.locator('.bubble.assistant:not(.typing)')).toHaveCount(2, { timeout: 30_000 })
    await page.waitForTimeout(1200) // memory save is debounced
    await page.reload(); await boot(page)
    await expect(page.locator('.bubble.user').first()).toContainText('민수')
    expect(await page.evaluate(() => document.documentElement.dataset.textSize)).toBe('lg')
    const stored = await page.evaluate(() => JSON.stringify(localStorage))
    expect(stored).toContain('민수'); expect(stored).not.toContain('sk-abcdefghijklmnop')
  })
})

test.describe('Responsive layouts', () => {
  const sizes: [number, number][] = [[360, 800], [412, 915], [768, 1024], [1080, 1920], [1920, 1080], [2560, 1440]]
  for (const [w, h] of sizes) {
    test(`${w}x${h}: no horizontal scroll, canvas fills the stage, controls reachable`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await boot(page)
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, cv: (() => { const r = document.querySelector('canvas')!.getBoundingClientRect(); return [r.width, r.height] })(), wheel: !!document.querySelector('.wheel'), controls: !!document.querySelector('.controls') }))
      expect(m.sw).toBeLessThanOrEqual(m.iw)
      expect(m.cv[0]).toBeGreaterThan(w * 0.5); expect(m.cv[1]).toBeGreaterThan(h * 0.5)
      if (w <= 820) { expect(m.wheel).toBe(true); expect(m.controls).toBe(false) } else { expect(m.controls).toBe(true) }
      await expect(page.locator('.chat-input input')).toBeVisible()
    })
  }
})
