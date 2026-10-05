import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

/** Warm ink canvas with a coral mark — Wantap language, not black/white. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0C0806"/><circle cx="256" cy="256" r="120" fill="none" stroke="#E8A87C" stroke-width="28"/><circle cx="352" cy="160" r="28" fill="#E8A87C"/></svg>`

export async function makeIcons(outDir = 'public/icons'): Promise<void> {
  mkdirSync(outDir, { recursive: true })
  mkdirSync('public', { recursive: true })
  writeFileSync(path.join('public', 'icon.svg'), SVG)
  const buf = Buffer.from(SVG)
  await sharp(buf).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'))
  await sharp(buf).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'))
  const mark = await sharp(buf)
    .resize(Math.round(512 * 0.6), Math.round(512 * 0.6))
    .png()
    .toBuffer()
  await sharp({
    create: { width: 512, height: 512, channels: 3, background: '#0C0806' },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, 'maskable-512.png'))
}

if (process.argv[1] && process.argv[1].includes('make-icons')) {
  void makeIcons()
}
