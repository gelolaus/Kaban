import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { expect, test } from 'vitest'
import { makeIcons } from './make-icons.ts'

test('makeIcons writes three png sizes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kaban-icons-'))
  try {
    await makeIcons(dir)
    for (const [file, size] of [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['maskable-512.png', 512],
    ] as const) {
      const meta = await sharp(path.join(dir, file)).metadata()
      expect(meta.width).toBe(size)
      expect(meta.height).toBe(size)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
