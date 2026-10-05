import { test, expect, type Page } from '@playwright/test'

const url = process.env.SPIKE_TURSO_URL
const authToken = process.env.SPIKE_TURSO_TOKEN
const hasCredentials = Boolean(url && authToken)

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => 'spike' in window)
}

test('T7: a second tab does not corrupt the first', async ({ context }) => {
  const page1 = await context.newPage()
  await boot(page1)
  await page1.evaluate(() => window.spike.open({ device: 'A' }))
  const id = await page1.evaluate(() => window.spike.addLedger('tab1', -1))
  expect(id.length).toBeGreaterThan(0)

  const page2 = await context.newPage()
  await boot(page2)
  const tab2 = await page2.evaluate(async () => {
    try {
      await window.spike.open({ device: 'A' })
      return { ok: true as const }
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })
  test.info().annotations.push({
    type: 'tab2',
    description: tab2.ok ? 'second open resolved' : `second open rejected: ${tab2.message}`,
  })
  console.log('T7 second tab:', tab2.ok ? 'resolved' : `rejected: ${tab2.message}`)

  const rowsAfter = await page1.evaluate(() => window.spike.listLedger())
  expect(rowsAfter.some((r) => r.id === id)).toBe(true)

  const id2 = await page1.evaluate(() => window.spike.addLedger('tab1-more', -2))
  expect(id2.length).toBeGreaterThan(0)

  await page2.close()

  const rowsFinal = await page1.evaluate(() => window.spike.listLedger())
  expect(rowsFinal.some((r) => r.id === id)).toBe(true)
  expect(rowsFinal.some((r) => r.id === id2)).toBe(true)
})

test.describe('failure with remote', () => {
  test.skip(!hasCredentials, 'needs SPIKE_TURSO_URL and SPIKE_TURSO_TOKEN')

  test('T8: push while offline rejects and keeps data', async ({ browser }) => {
    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    await boot(pageA)
    await pageA.evaluate(
      ({ url, authToken }) => window.spike.open({ device: 'A', url, authToken }),
      { url: url!, authToken: authToken! },
    )
    const id = await pageA.evaluate(() => window.spike.addLedger('offline-push', -3))

    await contextA.setOffline(true)
    const offlinePush = await pageA.evaluate(async () => {
      try {
        await window.spike.push()
        return { ok: true as const }
      } catch (err) {
        return {
          ok: false as const,
          message: err instanceof Error ? err.message : String(err),
        }
      }
    })
    expect(offlinePush.ok).toBe(false)
    console.log('T8 offline push error:', offlinePush.message)
    test.info().annotations.push({
      type: 't8-offline-push',
      description: offlinePush.message ?? 'no message',
    })

    const rowsOffline = await pageA.evaluate(() => window.spike.listLedger())
    expect(rowsOffline.some((r) => r.id === id)).toBe(true)

    await contextA.setOffline(false)
    await pageA.evaluate(() => window.spike.push())

    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    await boot(pageB)
    await pageB.evaluate(
      ({ url, authToken }) => window.spike.open({ device: 'B', url, authToken }),
      { url: url!, authToken: authToken! },
    )
    await pageB.evaluate(() => window.spike.pull())
    const rowsB = await pageB.evaluate(() => window.spike.listLedger())
    expect(rowsB.some((r) => r.id === id)).toBe(true)

    await contextA.close()
    await contextB.close()
  })

  test('T9: a wrong token gives an error and keeps local data', async ({ page }) => {
    await boot(page)

    // Establish local data first so we can prove it survives a bad remote open.
    await page.evaluate(() => window.spike.open({ device: 'A' }))
    const id = await page.evaluate(() => window.spike.addLedger('local-ok', -4))
    await page.evaluate(() => window.spike.close())

    // Observed: connect/open rejects immediately with InvalidToken (not deferred to pull).
    const openResult = await page.evaluate(async ({ url }) => {
      try {
        await window.spike.open({ device: 'A', url, authToken: 'invalid-token' })
        return { ok: true as const }
      } catch (err) {
        return {
          ok: false as const,
          message: err instanceof Error ? err.message : String(err),
        }
      }
    }, { url: url! })
    expect(openResult.ok).toBe(false)
    console.log('T9 invalid token open error:', openResult.message)
    test.info().annotations.push({
      type: 't9-invalid-token',
      description: openResult.message ?? 'no message',
    })

    // Local data remains readable and writable after the failed remote open.
    await page.evaluate(() => window.spike.open({ device: 'A' }))
    const rows = await page.evaluate(() => window.spike.listLedger())
    expect(rows.some((r) => r.id === id && r.category === 'local-ok')).toBe(true)
    const id2 = await page.evaluate(() => window.spike.addLedger('local-ok-2', -5))
    expect(id2.length).toBeGreaterThan(0)
  })
})
