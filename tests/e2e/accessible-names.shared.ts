import { expect, type Page } from '@playwright/test'

export const ACCESSIBLE_NAME_ROUTES = [
  '/home',
  '/plan',
  '/spending',
  '/accounts',
  '/reflect',
  '/settings',
] as const

export async function waitAppReady(page: Page, route: string): Promise<void> {
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
          return !!document.querySelector('.shell, main h1, #content h1, h1')
        }),
      { timeout: 60_000 },
    )
    .toBe(true)
  await expect(page.locator('main h1, h1, .shell').first()).toBeVisible({ timeout: 60_000 })
}

export async function assertVisibleControlsHaveNames(page: Page): Promise<void> {
  const controls = page.locator('a, button')
  const total = await controls.count()
  let checked = 0
  for (let i = 0; i < total; i++) {
    const el = controls.nth(i)
    if (!(await el.isVisible())) continue
    await expect(el, `control index ${i}`).toHaveAccessibleName(/\S/)
    checked += 1
  }
  expect(checked, 'expected at least one visible button or link').toBeGreaterThan(0)
}
