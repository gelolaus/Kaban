import { expect, test } from '@playwright/test'

async function resolvedVar(page: import('@playwright/test').Page, name: string): Promise<string> {
  return page.evaluate((token) => {
    const div = document.createElement('div')
    div.style.backgroundColor = `var(${token})`
    document.body.append(div)
    const color = getComputedStyle(div).backgroundColor
    div.remove()
    return color
  }, name)
}

test('dark tokens resolve', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  expect(await resolvedVar(page, '--bg')).toBe('rgb(12, 8, 6)')
  expect(await resolvedVar(page, '--surface')).toBe('rgb(20, 14, 11)')
  expect(await resolvedVar(page, '--ink-2')).toBe('rgb(174, 162, 152)')
  expect(await resolvedVar(page, '--accent')).toBe('rgb(232, 168, 124)')
  expect(await resolvedVar(page, '--accent-wash')).toBe('rgb(58, 42, 31)')
  expect(await resolvedVar(page, '--line-strong')).toBe('rgb(122, 111, 102)')
})

test('light tokens resolve', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  expect(await resolvedVar(page, '--bg')).toBe('rgb(250, 246, 241)')
  expect(await resolvedVar(page, '--ink-2')).toBe('rgb(97, 86, 77)')
  expect(await resolvedVar(page, '--accent-text')).toBe('rgb(132, 73, 37)')
  expect(await resolvedVar(page, '--accent-wash')).toBe('rgb(251, 238, 228)')
  expect(await resolvedVar(page, '--line-strong')).toBe('rgb(143, 132, 122)')
})

test('density and phone row height', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    document.documentElement.dataset.density = 'comfortable'
  })
  const rowH = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--row-h').trim(),
  )
  expect(rowH).toBe('52px')

  await page.setViewportSize({ width: 390, height: 844 })
  const phoneRow = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--row-h').trim(),
  )
  expect(phoneRow).toBe('56px')
})

test('body uses Plus Jakarta Sans and color-scheme is dual', async ({ page }) => {
  await page.goto('/')
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  expect(font).toContain('Plus Jakarta Sans')
  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
  expect(scheme).toBe('light dark')
})

test('display titles use Syne', async ({ page }) => {
  await page.goto('/plan')
  await expect(page.locator('.shell')).toBeVisible({ timeout: 60_000 })
  const font = await page.evaluate(() => {
    const h = document.querySelector('h1')
    return h ? getComputedStyle(h).fontFamily : ''
  })
  expect(font).toContain('Syne')
})

test('money glyphs and tabular nums', async ({ page }) => {
  await page.goto('/plan')
  await expect(page.locator('[data-testid="ready-to-assign"]')).toBeVisible({ timeout: 60_000 })

  const report = await page.evaluate(async () => {
    await document.fonts.ready

    function measure(text: string, fontFamily: string, size = '16px'): number {
      const span = document.createElement('span')
      span.textContent = text
      span.style.fontFamily = fontFamily
      span.style.fontSize = size
      span.style.fontVariantNumeric = 'tabular-nums'
      span.style.fontFeatureSettings = '"tnum" 1'
      span.style.position = 'absolute'
      span.style.visibility = 'hidden'
      span.style.whiteSpace = 'nowrap'
      document.body.append(span)
      const w = span.getBoundingClientRect().width
      span.remove()
      return w
    }

    const bodyFont = '"Plus Jakarta Sans"'
    const displayFont = 'Syne'

    const pesoW = measure('₱', bodyFont)
    const minusW = measure('−', bodyFont)
    const digitW = measure('8', bodyFont)
    const tabular = getComputedStyle(document.body).fontVariantNumeric.includes('tabular-nums')

    const digitWidths = [...'0123456789'].map((d) => measure(d, bodyFont))
    const max = Math.max(...digitWidths)
    const min = Math.min(...digitWidths)
    const tabularish = max - min < 0.75

    const syneDigit = measure('8', displayFont, '28px')

    return {
      ok: true,
      pesoW,
      minusW,
      digitW,
      tabular,
      tabularish,
      digitSpread: max - min,
      syneDigit,
      bodyFont,
      displayFont,
    }
  })

  expect(report.ok).toBe(true)
  expect(report.pesoW!, 'peso glyph width').toBeGreaterThan(report.digitW! * 0.4)
  expect(report.minusW!, 'minus glyph width').toBeGreaterThan(0)
  expect(report.tabular).toBe(true)
  expect(
    report.tabularish,
    `digits should be near-equal width (spread ${report.digitSpread})`,
  ).toBe(true)
  expect(report.syneDigit!, 'Syne digit readable').toBeGreaterThan(8)
})
