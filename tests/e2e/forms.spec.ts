import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/gallery')
})

test('money field validates on blur', async ({ page }) => {
  const amount = page.getByLabel('Amount')
  await amount.fill('1,200.5x')
  await expect(page.getByText('Use numbers like 1,200.50.')).toHaveCount(0)
  await amount.blur()
  await expect(page.getByText('Use numbers like 1,200.50.')).toBeVisible()
  await expect(amount).toHaveAttribute('aria-invalid', 'true')
  const describedBy = await amount.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  const desc = await page.locator(`#${describedBy}`).innerText()
  expect(desc).toContain('Use numbers like 1,200.50.')

  await amount.fill('1,200.50')
  await amount.blur()
  await expect(page.getByText('Use numbers like 1,200.50.')).toHaveCount(0)
})

test('mobile font size and coarse pointer rule', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const amount = page.getByLabel('Amount')
  const fontSize = await amount.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(fontSize).toBeGreaterThanOrEqual(16)

  const hasCoarseRule = await page.evaluate(() => {
    const walk = (rules: CSSRuleList): boolean => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) {
          const media = rule.media.mediaText
          if (media.includes('pointer: coarse')) {
            for (const inner of Array.from(rule.cssRules)) {
              if (inner instanceof CSSStyleRule && inner.cssText.includes('3rem')) return true
              if (inner instanceof CSSLayerBlockRule && walk(inner.cssRules)) return true
            }
            return true
          }
        }
        if (rule instanceof CSSLayerBlockRule && walk(rule.cssRules)) return true
      }
      return false
    }
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (walk(sheet.cssRules)) return true
      } catch {
        /* ignore */
      }
    }
    return false
  })
  expect(hasCoarseRule).toBe(true)
})

for (const scheme of ['dark', 'light'] as const) {
  test(`axe forms ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/dev/gallery')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
}
