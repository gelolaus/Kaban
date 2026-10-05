import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('laptop shell', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page).toHaveURL(/\/plan/)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 60_000 })
  const mainNav = page.getByRole('navigation', { name: 'Main' })
  await expect(mainNav.getByRole('link', { name: 'Plan' })).toBeVisible()
  await expect(mainNav.getByRole('link', { name: 'Spending' })).toBeVisible()
  await expect(mainNav.getByRole('link', { name: 'All accounts' })).toBeVisible()
  await expect(mainNav.getByRole('link', { name: 'Reflect' })).toBeVisible()
  await expect(mainNav.getByRole('link', { name: 'Settings' })).toBeVisible()
  await expect(mainNav.getByRole('link', { name: 'Home' })).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Tabs' })).toBeHidden()
})

test('tablet rail', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1024 })
  await page.goto('/plan')
  const mainNav = page.getByRole('navigation', { name: 'Main' })
  await expect(mainNav).toBeVisible()
  await expect(mainNav.getByRole('link', { name: 'Plan' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Tabs' })).toBeHidden()
})

test('phone tabs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page).toHaveURL(/\/home/)
  const tabs = page.getByRole('navigation', { name: 'Tabs' })
  await expect(tabs.getByRole('link')).toHaveCount(5)
  await expect(tabs.getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'Plan' })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'Spending' })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'Accounts' })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'Reflect' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()

  await page.goto('/plan')
  await expect(page.getByRole('button', { name: 'Transaction' })).toBeVisible()
  await page.goto('/reflect')
  await expect(page.getByRole('button', { name: 'Transaction' })).toHaveCount(0)

  await page.goto('/plan')
  await page.getByRole('button', { name: 'Transaction' }).click()
  await expect(page.getByRole('dialog', { name: 'New transaction' })).toBeVisible()
})

test('skip link and route announcer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/plan')
  await page.locator('.skip-link').focus()
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#content')).toBeFocused()

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Spending' })
    .click()
  await expect(page).toHaveTitle('Spending | Kaban')
  await expect(page.getByRole('heading', { name: 'Spending', level: 1 })).toBeFocused()
})

test('not found', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible()
  await expect(page).toHaveTitle('Not found | Kaban')
  await page.getByRole('link', { name: 'Go home' }).click()
  await expect(page).toHaveURL(/\/(plan|home)/)
})

test('settings theme and density', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/settings')
  const button = page.getByRole('button', { name: /Use (dark|light|system) theme/ })
  await button.click()
  const content = await page.locator('meta[name="color-scheme"]').getAttribute('content')
  expect(content === 'light' || content === 'dark').toBe(true)
  await page.reload()
  const after = await page.locator('meta[name="color-scheme"]').getAttribute('content')
  expect(after).toBe(content)

  await page.getByLabel('Comfortable').check()
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.density))
    .toBe('comfortable')
  await page.reload()
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.density))
    .toBe('comfortable')
})

test('corrupt preferences still render', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kaban:color-scheme', 'blue')
    localStorage.setItem('kaban:density', 'huge')
  })
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})

const screens = [
  { path: '/plan', size: { width: 1440, height: 900 } },
  { path: '/settings', size: { width: 820, height: 1024 } },
  { path: '/nope', size: { width: 390, height: 844 } },
]

for (const screen of screens) {
  for (const scheme of ['dark', 'light'] as const) {
    test(`axe ${screen.path} ${scheme} ${screen.size.width}`, async ({ page }) => {
      await page.setViewportSize(screen.size)
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(screen.path)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })
  }
}
