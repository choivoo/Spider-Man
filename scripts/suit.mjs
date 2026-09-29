// node scripts/suit.mjs out.png cam "state,state,..."   state: civ | spider | up:0.9 | down:1.0 | spider-open
import { chromium } from '@playwright/test'
const out = process.argv[2]; const cam = process.argv[3] || 'full'; const list = (process.argv[4] || 'spider').split(',')
const W = +(process.argv[5] || 800), H = +(process.argv[6] || 900)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log('[console.error]', m.text().slice(0, 500)) })
await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.waitForTimeout(3000)
await page.evaluate((c) => window.__spider.store.getState().setCameraMode(c), cam)
await page.waitForTimeout(1500)
for (const it of list) {
  await page.evaluate((it) => {
    const { nano } = window.__spider
    nano.frozen = false
    const [k, t] = it.split(':')
    if (k === 'civ') nano.reset('CIVILIAN')
    else if (k === 'spider') nano.reset('SPIDER')
    else if (k === 'spider-open') { nano.reset('SPIDER'); nano.dispatch('MASK_OPEN'); for (let i = 0; i < 100; i++) nano.update(0.05) }
    else if (k === 'up') nano.scrub('up', parseFloat(t))
    else if (k === 'down') nano.scrub('down', parseFloat(t))
  }, it)
  await page.waitForTimeout(1600)
  await page.screenshot({ path: out.replace('.png', `_${it.replace(/[^a-z0-9.]/gi, '')}.png`), clip: { x: 100, y: 0, width: W, height: H } })
}
await browser.close()
