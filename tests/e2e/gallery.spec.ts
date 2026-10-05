import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

function contrastRatio(fg: string, bg: string): number {
  const parse = (c: string) => {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!m) return [0, 0, 0]
    return [Number(m[1]), Number(m[2]), Number(m[3])]
  }
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const lum = (c: string) => {
    const [r, g, b] = parse(c)
    return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!)
  }
  const L1 = lum(fg)
  const L2 = lum(bg)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/gallery')
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible()
})

test('button is focusable with outline and min height', async ({ page }) => {
  const btn = page.getByRole('button', { name: 'Assign' })
  await expect(btn).toBeVisible()
  await btn.focus()
  const outline = await btn.evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).not.toBe('none')
  const box = await btn.boundingBox()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(24)
})

test('status pill announces overspent', async ({ page }) => {
  await expect(page.getByText('Overspent by ₱500.00')).toBeAttached()
  await expect(page.getByText('−₱500.00')).toBeVisible()
  const under = page.locator('.status-underfunded')
  const border = await under.evaluate((el) => getComputedStyle(el).borderTopWidth)
  expect(border).toBe('1px')
  const zeroBg = await page
    .locator('.status-zero')
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(zeroBg === 'rgba(0, 0, 0, 0)' || zeroBg === 'transparent').toBe(true)
})

test('progress bar clamps', async ({ page }) => {
  const bar = page.getByRole('progressbar', { name: 'Groceries funded' })
  await expect(bar).toBeVisible()
  const value = await bar.evaluate((el: HTMLProgressElement) => el.value)
  expect(value).toBe(100)
})

test('chip toggles aria-pressed', async ({ page }) => {
  const chip = page.getByRole('button', { name: 'Filter' })
  await expect(chip).toHaveAttribute('aria-pressed', 'false')
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
})

for (const scheme of ['dark', 'light'] as const) {
  test(`axe gallery ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/dev/gallery')
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
}

test('ink-2 contrast in light mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/dev/gallery')
  await page.waitForSelector('p.ink-2')
  const { fg, bg } = await page.evaluate(() => {
    const el = document.querySelector('p.ink-2')
    if (!el) throw new Error('missing .ink-2 sample')
    const style = getComputedStyle(el)
    return { fg: style.color, bg: getComputedStyle(document.body).backgroundColor }
  })
  expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
})
