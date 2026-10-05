import { expect, test, type Page, type Locator } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

function parseRgb(color: string): { r: number; g: number; b: number } | null {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance(rgb: { r: number; g: number; b: number }): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

function contrastRatio(fg: string, bg: string): number | null {
  const a = parseRgb(fg)
  const b = parseRgb(bg)
  if (!a || !b) return null
  const l1 = luminance(a)
  const l2 = luminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

async function solidBackground(page: Page, el: Locator): Promise<string> {
  return el.evaluate((node) => {
    let cur: Element | null = node
    while (cur) {
      const bg = getComputedStyle(cur).backgroundColor
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
      cur = cur.parentElement
    }
    return getComputedStyle(document.body).backgroundColor
  })
}

async function waitAppReady(page: Page, route: string) {
  await page.goto(route)
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const t = document.body?.innerText ?? ''
          if (
            !t ||
            t.includes('Opening local budget') ||
            t.includes('already open in another tab')
          ) {
            return false
          }
          return !!document.querySelector('.shell, .shell-main h1, #content h1')
        }),
      { timeout: 60_000 },
    )
    .toBe(true)
  await expect(
    page
      .locator('.shell, [data-testid="ready-to-assign"], [data-testid="ready-to-assign-phone"]')
      .first(),
  ).toBeVisible({
    timeout: 60_000,
  })
}

async function assertInteractiveContrast(page: Page) {
  const controls = page.locator('button, a, .chip')
  const total = await controls.count()
  let checked = 0
  for (let i = 0; i < total; i++) {
    const el = controls.nth(i)
    if (!(await el.isVisible())) continue
    const text = ((await el.innerText()) || '').trim()
    if (!text) continue
    const color = await el.evaluate((n) => getComputedStyle(n).color)
    const bg = await solidBackground(page, el)
    const ratio = contrastRatio(color, bg)
    expect(ratio, `${text.slice(0, 40)} color=${color} bg=${bg}`).toBeGreaterThanOrEqual(4.5)
    checked += 1
  }
  expect(checked).toBeGreaterThan(0)
}

const routes = ['/plan', '/spending', '/accounts', '/settings'] as const

for (const width of [1440, 390] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`contrast ${scheme} ${width}px routes and transaction sheet`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      await page.emulateMedia({ colorScheme: scheme })

      for (const route of routes) {
        await waitAppReady(page, route)
        await assertInteractiveContrast(page)
      }

      await waitAppReady(page, '/plan')
      await page.getByRole('button', { name: 'Transaction' }).click()
      const dialog = page.getByRole('dialog', { name: 'New transaction' })
      await expect(dialog).toBeVisible()
      await assertInteractiveContrast(page)
    })
  }
}
