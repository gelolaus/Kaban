import { test } from '@playwright/test'
import {
  ACCESSIBLE_NAME_ROUTES,
  assertVisibleControlsHaveNames,
  waitAppReady,
} from './accessible-names.shared.ts'

test.describe.configure({ mode: 'serial' })

for (const scheme of ['dark', 'light'] as const) {
  test(`accessible names at 820px ${scheme}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 820, height: 1024 })
    await page.emulateMedia({ colorScheme: scheme })

    for (const route of ACCESSIBLE_NAME_ROUTES) {
      await waitAppReady(page, route)
      await assertVisibleControlsHaveNames(page)
    }
  })
}
