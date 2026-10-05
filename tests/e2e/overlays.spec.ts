import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/gallery')
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible()
})

test('sheet focus trap and return', async ({ page }) => {
  await page.getByRole('button', { name: 'Open sheet' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog).toBeVisible()

  for (let i = 0; i < 10; i++) await page.keyboard.press('Tab')
  const inside = await page.evaluate(() => {
    const d = document.querySelector('dialog[open]')
    return !!d && d.contains(document.activeElement)
  })
  expect(inside).toBe(true)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Open sheet' })).toBeFocused()

  await page.getByRole('button', { name: 'Open sheet' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()

  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Open sheet' }).click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  }
})

test('toasts announce stack and dismiss', async ({ page }) => {
  await page.getByRole('button', { name: 'Show 3 toasts' }).click()
  await expect.poll(async () => page.locator('[role="status"]').innerText()).toContain('One')
  await expect.poll(async () => page.locator('[role="status"]').innerText()).toContain('Two')
  await expect.poll(async () => page.locator('[role="status"]').innerText()).toContain('Three')

  const boxes = await page.locator('.toast').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }),
  )
  expect(boxes.length).toBe(3)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!
      const b = boxes[j]!
      const overlap = !(
        a.x + a.w <= b.x ||
        b.x + b.w <= a.x ||
        a.y + a.h <= b.y ||
        b.y + b.h <= a.y
      )
      expect(overlap).toBe(false)
    }
  }

  await page.waitForTimeout(3500)
  await expect(page.locator('.toast')).toHaveCount(0)

  await page.getByRole('button', { name: 'Show update toast' }).click()
  await expect(page.locator('.toast').filter({ hasText: 'Update ready' })).toBeVisible()
  await page.waitForTimeout(5000)
  await expect(page.locator('.toast').filter({ hasText: 'Update ready' })).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.locator('.toast').filter({ hasText: 'Update ready' })).toHaveCount(0)
})

for (const scheme of ['dark', 'light'] as const) {
  test(`axe overlays ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/dev/gallery')
    await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible()
    await page.getByRole('button', { name: 'Open sheet' }).click()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
}
