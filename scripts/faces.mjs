// node scripts/faces.mjs out.png cam emo1,emo2,... ; emo may be "speak:AA"
import { chromium } from '@playwright/test'
const out = process.argv[2]; const cam = process.argv[3] || 'face'; const list = process.argv[4].split(',')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)))
await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.waitForTimeout(2500)
await page.evaluate((c) => window.__spider.store.getState().setCameraMode(c), cam)
await page.waitForTimeout(1500)
for (const it of list) {
  await page.evaluate((it) => {
    const d = window.__spider.director
    d.look.userBias = 1
    if (it.startsWith('speak:')) { d.setEmotion('neutral', 0.3); d.beginSpeech(it.slice(6).replace(/_/g, ' '), { duration: 30 }) }
    else { d.endSpeech(); const [e, f] = it.split('/'); d.setEmotion(e, 0.9, f || undefined) }
  }, it)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: out.replace('.png', `_${it.replace(/[^a-z0-9]/gi, '')}.png`), clip: { x: 150, y: 100, width: 500, height: 600 } })
}
await browser.close()
