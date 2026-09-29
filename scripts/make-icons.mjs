// Renders public/icons/icon.svg → PNGs (192, 512, maskable 512, apple-touch 180). Run: npm run icons
import { chromium } from '@playwright/test'
import fs from 'node:fs'
const svg = fs.readFileSync('public/icons/icon.svg', 'utf8')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage()
const shot = async (size, file, inset = 0, bg = 'transparent') => {
  await page.setViewportSize({ width: size, height: size })
  const s = size - inset * 2
  await page.setContent(`<body style="margin:0;background:${bg}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center"><div style="width:${s}px;height:${s}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body>`)
  await page.screenshot({ path: file, omitBackground: bg === 'transparent' })
}
await shot(192, 'public/icons/icon-192.png')
await shot(512, 'public/icons/icon-512.png')
await shot(180, 'public/icons/apple-touch-icon.png', 0, '#0a0b10')
await shot(512, 'public/icons/icon-maskable-512.png', 56, '#0a0b10') // safe zone padding
await browser.close()
