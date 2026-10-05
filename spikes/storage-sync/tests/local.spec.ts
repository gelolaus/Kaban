import { test, expect, type Page } from '@playwright/test'

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => 'spike' in window)
}

test('T1: entries survive a reload', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.spike.open({ device: 'A' }))
  const id = await page.evaluate(() => window.spike.addLedger('food', -120000))
  expect(id.length).toBeGreaterThan(0)

  await page.reload()
  await page.waitForFunction(() => 'spike' in window)
  await page.evaluate(() => window.spike.open({ device: 'A' }))
  const rows = await page.evaluate(() => window.spike.listLedger())
  expect(rows).toHaveLength(1)
  expect(rows[0]?.delta).toBe(-120000)
  expect(rows[0]?.device).toBe('A')
})

test('T2: entries survive closing the page right after a write', async ({ context }) => {
  const categories = ['rent', 'food', 'utilities'] as const

  for (const category of categories) {
    const page = await context.newPage()
    await boot(page)
    await page.evaluate(() => window.spike.open({ device: 'A' }))
    // Complete the write, then close the page immediately without awaiting anything else.
    await page.evaluate((cat) => window.spike.addLedger(cat, -500000), category)
    await page.close()
  }

  const page = await context.newPage()
  await boot(page)
  await page.evaluate(() => window.spike.open({ device: 'A' }))
  const rows = await page.evaluate(() => window.spike.listLedger())
  expect(rows).toHaveLength(3)
  const found = new Set(rows.map((r) => r.category))
  for (const category of categories) {
    expect(found.has(category)).toBe(true)
  }
})

test('T2b: notes round-trip', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.spike.open({ device: 'A' }))
  await page.evaluate(() => window.spike.setNote('n1', 'x'))
  const value = await page.evaluate(() => window.spike.getNote('n1'))
  expect(value).toBe('x')
  const missing = await page.evaluate(() => window.spike.getNote('missing'))
  expect(missing).toBeNull()
})

test('T2c: ids are unique ULIDs', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.spike.open({ device: 'A' }))
  const ids = await page.evaluate(async () => {
    const out: string[] = []
    for (let i = 0; i < 50; i++) {
      out.push(await window.spike.addLedger(`cat-${i}`, i))
    }
    return out
  })
  expect(ids).toHaveLength(50)
  expect(new Set(ids).size).toBe(50)
  for (const id of ids) {
    expect(id).toHaveLength(26)
  }
})
