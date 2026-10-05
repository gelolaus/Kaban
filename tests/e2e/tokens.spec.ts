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
  expect(await resolvedVar(page, '--surface')).toBe('rgb(19, 19, 19)')
  expect(await resolvedVar(page, '--ink-2')).toBe('rgb(143, 143, 143)')
})

test('light tokens resolve', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  expect(await resolvedVar(page, '--bg')).toBe('rgb(242, 242, 242)')
  expect(await resolvedVar(page, '--ink-2')).toBe('rgb(107, 107, 107)')
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

test('body uses Geist and color-scheme is dual', async ({ page }) => {
  await page.goto('/')
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  expect(font).toContain('Geist Variable')
  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
  expect(scheme).toBe('light dark')
})
