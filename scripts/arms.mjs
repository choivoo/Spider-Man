import { chromium } from '@playwright/test'
const out = process.argv[2]; const cam = process.argv[3] || 'full'; const list = (process.argv[4] || 'IDLE').split(',')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)))
await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.waitForTimeout(3000)
await page.evaluate((c) => { window.__spider.store.getState().setCameraMode(c); window.__spider.nano.reset('SPIDER') }, cam)
await page.waitForTimeout(1200)
await page.evaluate(() => { const n = window.__spider.nano; n.dispatch('ARMS_DEPLOY'); for (let i = 0; i < 100; i++) n.update(0.05) })
for (const it of list) {
  await page.evaluate((it) => {
    const n = window.__spider.nano
    if (it.startsWith('p')) { n.debugArms(parseFloat(it.slice(1))) }
    else { n.arms = 'ARMS_DEPLOYED'; n.armsProgress = 1; n.setArmsMode(it) }
  }, it)
  await page.waitForTimeout(2600)
  await page.screenshot({ path: out.replace('.png', `_${it}.png`), clip: { x: 100, y: 0, width: 800, height: 900 } })
}
await browser.close()
