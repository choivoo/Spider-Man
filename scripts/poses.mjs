// Renders a contact sheet of gestures: node scripts/poses.mjs out.png wave,nod,...
import { chromium } from '@playwright/test'
const out = process.argv[2]; const names = (process.argv[3] || 'wave').split(',')
const cam = process.argv[4] || 'upper'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)))
await page.goto('http://localhost:5173/?stage=1', { waitUntil: 'load' })
await page.waitForTimeout(2500)
await page.evaluate((c) => { window.__spider.store.getState().setCameraMode(c) }, cam)
await page.waitForTimeout(1500)
for (const n of names) {
  const [name, t] = n.split(':')
  await page.evaluate(([nm, tt]) => {
    const d = window.__spider.director
    d.anim.release()
    if (nm === 'hands_in_pocket' || nm === 'cross_arms') { d.anim.freeze(null); d.anim.play(nm) } else d.anim.freeze(nm === 'rest' ? null : nm, parseFloat(tt || '0.8'))
  }, [name, t])
  await page.waitForTimeout(2800)
  await page.screenshot({ path: out.replace('.png', `_${name}.png`), clip: { x: 0, y: 0, width: 800, height: 900 } })
}
await browser.close()
