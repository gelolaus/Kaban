import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

const url = process.env.SPIKE_TURSO_URL
const authToken = process.env.SPIKE_TURSO_TOKEN

const hasCredentials = Boolean(url && authToken)

test.describe('sync', () => {
  test.skip(!hasCredentials, 'needs SPIKE_TURSO_URL and SPIKE_TURSO_TOKEN')

  let contextA: BrowserContext
  let contextB: BrowserContext
  let pageA: Page
  let pageB: Page

  async function boot(page: Page): Promise<void> {
    await page.goto('/')
    await page.waitForFunction(() => 'spike' in window)
  }

  async function openRemote(
    page: Page,
    device: string,
    extra?: { ensureSchema?: boolean },
  ): Promise<void> {
    await page.evaluate(
      ({ device, url, authToken, ensureSchema }) =>
        window.spike.open({ device, url, authToken, ensureSchema }),
      { device, url: url!, authToken: authToken!, ensureSchema: extra?.ensureSchema },
    )
  }

  async function resetRemote(browser: Browser): Promise<void> {
    const context = await browser.newContext()
    const page = await context.newPage()
    await boot(page)
    await openRemote(page, 'reset')
    await page.evaluate(() => window.spike.resetRemote())
    await context.close()
  }

  test.beforeEach(async ({ browser }) => {
    await resetRemote(browser)
    contextA = await browser.newContext()
    contextB = await browser.newContext()
    pageA = await contextA.newPage()
    pageB = await contextB.newPage()
    await boot(pageA)
    await boot(pageB)
  })

  test.afterEach(async () => {
    await contextA?.close()
    await contextB?.close()
  })

  test('T3: second device bootstraps existing tables and rows', async () => {
    await openRemote(pageA, 'A')
    await pageA.evaluate(() => window.spike.addLedger('food', -1))
    await pageA.evaluate(() => window.spike.addLedger('rent', -2))
    await pageA.evaluate(() => window.spike.push())

    await openRemote(pageB, 'B', { ensureSchema: false })
    const names = await pageB.evaluate(() => window.spike.tableNames())
    expect(names).toEqual(expect.arrayContaining(['ledger', 'note']))
    const rows = await pageB.evaluate(() => window.spike.listLedger())
    expect(rows).toHaveLength(2)
    const categories = rows.map((r) => r.category).sort()
    expect(categories).toEqual(['food', 'rent'])
  })

  test('T4: two offline edits to different rows both survive', async () => {
    await openRemote(pageA, 'A')
    await openRemote(pageB, 'B')
    await pageA.evaluate(() => window.spike.pull())
    await pageB.evaluate(() => window.spike.pull())

    await contextA.setOffline(true)
    await contextB.setOffline(true)

    await pageA.evaluate(() => window.spike.addLedger('a', -10))
    await pageB.evaluate(() => window.spike.addLedger('b', -20))

    await contextA.setOffline(false)
    await contextB.setOffline(false)

    await pageA.evaluate(() => window.spike.push())
    await pageB.evaluate(() => window.spike.push())
    await pageA.evaluate(() => window.spike.pull())
    await pageB.evaluate(() => window.spike.pull())

    const rowsA = await pageA.evaluate(() => window.spike.listLedger())
    const rowsB = await pageB.evaluate(() => window.spike.listLedger())
    expect(rowsA).toHaveLength(2)
    expect(rowsB).toHaveLength(2)
    expect(rowsA.map((r) => r.category).sort()).toEqual(['a', 'b'])
    expect(rowsB.map((r) => r.category).sort()).toEqual(['a', 'b'])
  })

  test('T5: last push wins for the same row', async () => {
    await openRemote(pageA, 'A')
    await pageA.evaluate(() => window.spike.setNote('n1', 'start'))
    await pageA.evaluate(() => window.spike.push())

    await openRemote(pageB, 'B')
    await pageB.evaluate(() => window.spike.pull())
    expect(await pageB.evaluate(() => window.spike.getNote('n1'))).toBe('start')

    await contextA.setOffline(true)
    await contextB.setOffline(true)
    await pageA.evaluate(() => window.spike.setNote('n1', 'from-A'))
    await pageB.evaluate(() => window.spike.setNote('n1', 'from-B'))

    await contextA.setOffline(false)
    await contextB.setOffline(false)
    await pageA.evaluate(() => window.spike.push())
    await pageB.evaluate(() => window.spike.push())
    await pageA.evaluate(() => window.spike.pull())
    await pageB.evaluate(() => window.spike.pull())

    const noteA = await pageA.evaluate(() => window.spike.getNote('n1'))
    const noteB = await pageB.evaluate(() => window.spike.getNote('n1'))
    expect(noteA).toBe('from-B')
    expect(noteB).toBe('from-B')
  })

  test('T6: a write made offline survives a reload while still offline', async ({ browser }) => {
    // Full setOffline(true) blocks localhost too; without a service worker (Task 5 / T10)
    // the page cannot reload. Block only the Turso host so Vite can still serve the shell.
    const tursoHost = new URL(url!).host

    const context = await browser.newContext()
    const page = await context.newPage()
    await boot(page)
    await openRemote(page, 'A')

    await context.route('**/*', async (route) => {
      const requestUrl = route.request().url()
      let host = ''
      try {
        host = new URL(requestUrl).host
      } catch {
        await route.continue()
        return
      }
      if (host === tursoHost) {
        await route.abort('internetdisconnected')
        return
      }
      await route.continue()
    })

    await expect(page.evaluate(() => window.spike.push())).rejects.toBeTruthy()

    await page.evaluate(() => window.spike.addLedger('offline', -99))
    await page.reload()
    await page.waitForFunction(() => 'spike' in window)
    await openRemote(page, 'A')

    const rows = await page.evaluate(() => window.spike.listLedger())
    expect(rows.some((r) => r.category === 'offline' && r.delta === -99)).toBe(true)

    await context.unroute('**/*')
    await page.evaluate(() => window.spike.push())

    await context.close()
  })
})
