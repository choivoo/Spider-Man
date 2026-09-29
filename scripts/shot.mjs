// Usage: node scripts/shot.mjs <url> <out.png> [--w=1280 --h=800] [--wait=ms] [--eval="js"] [--mobile]
import { chromium } from '@playwright/test'
const [url, out, ...rest] = process.argv.slice(2)
const arg = (k, d) => (rest.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=').slice(1).join('=') || d
const w = +arg('w', 1280), h = +arg('h', 800), wait = +arg('wait', 2500)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] })
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: rest.includes('--mobile') })
const page = await ctx.newPage()
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[console.' + m.type() + ']', m.text().slice(0, 300)) })
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)))
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(wait)
const ev = arg('eval', '')
if (ev) { const r = await page.evaluate(ev); if (r !== undefined) console.log('[eval]', JSON.stringify(r)); await page.waitForTimeout(+arg('wait2', 1500)) }
await page.screenshot({ path: out })
await browser.close()
