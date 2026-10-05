import { test, expect } from '@playwright/test'
import type { EnvReport } from '../src/spike-api'
test('T0: probe reports a secure OPFS context and handles persistence', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => 'spike' in window)
  const env: EnvReport = await page.evaluate(() => window.spike.probe())
  expect(env.secureContext).toBe(true)
  expect(env.opfs).toBe(true)
  expect(typeof env.persistSupported).toBe('boolean')
  const granted = await page.evaluate(() => window.spike.persist())
  expect(typeof granted).toBe('boolean')
})
