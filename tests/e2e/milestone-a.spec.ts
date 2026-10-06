import { expect, test, type Page } from '@playwright/test'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test.describe.configure({ mode: 'serial' })

async function waitReady(page: Page) {
  await page.goto('/plan')
  await expect(page.locator('[data-testid="ready-to-assign"]:visible')).toBeVisible({
    timeout: 60_000,
  })
}

async function addAccount(page: Page, name: string, balance: string) {
  await page.goto('/accounts')
  await page.getByRole('button', { name: 'Add account' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Checking').check()
  await page.getByLabel('Starting balance').fill(balance)
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

async function selectCategory(page: Page, name: string) {
  await page.goto('/plan')
  await page.getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toContainText(name)
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await waitReady(page)
})

test('create monthly target, see needed text, snooze, and set current goal', async ({ page }) => {
  await addAccount(page, 'MA Cash', '20000')
  await selectCategory(page, 'Groceries')

  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await inspector.getByRole('button', { name: 'Add target' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add target' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Monthly').check()
  await dialog.getByLabel('Amount').fill('5000')
  await dialog.getByLabel('Behavior').selectOption({ label: 'Set aside another' })
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()

  await expect(inspector.locator('.plan-needed')).toContainText(/more needed/i)
  await expect(page.getByTitle('Underfunded').first()).toBeVisible()

  await inspector.getByRole('button', { name: 'Snooze this month' }).click()
  await expect(page.getByTitle('Snoozed').first()).toBeVisible()
  await page.getByRole('button', { name: 'Snoozed' }).click()
  await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'All' }).click()
  await selectCategory(page, 'Groceries')
  await inspector.getByRole('button', { name: 'Unsnooze' }).click()
  await inspector.getByRole('button', { name: 'Set as current goal' }).click()

  await page.goto('/')
  await expect(page.getByRole('progressbar')).toBeVisible()
  await expect(page.getByText('Complete')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adjust' })).toBeVisible()
})

test('Auto-Assign preview, Undo Redo by button and key, Move Money, Recent Moves', async ({
  page,
}) => {
  await addAccount(page, 'AA Cash', '10000')
  await selectCategory(page, 'Dining out')
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await inspector.getByRole('button', { name: 'Add target' }).click()
  const targetDialog = page.getByRole('dialog', { name: 'Add target' })
  await targetDialog.getByLabel('Amount').fill('1500')
  await targetDialog.getByRole('button', { name: 'Save' }).click()
  await expect(targetDialog).toBeHidden()

  await page.getByRole('button', { name: 'Auto-Assign', exact: true }).first().click()
  const aa = page.getByRole('dialog', { name: 'Auto-Assign' })
  await expect(aa).toBeVisible()
  await aa.getByLabel('Option').selectOption({ label: 'Underfunded' })
  await expect(aa.getByRole('table')).toBeVisible()
  await aa.getByRole('button', { name: 'Save assignments' }).click()
  await expect(aa).toBeHidden()

  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled()
  await page.getByRole('button', { name: 'Redo' }).click()

  await page.keyboard.press('Control+z')
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled()
  await page.keyboard.press('Control+y')
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()

  await selectCategory(page, 'Groceries')
  await inspector.getByLabel('Assign').fill('800')
  await inspector.getByRole('button', { name: 'Save assignment' }).click()

  await page.getByRole('button', { name: 'Move Money' }).click()
  const move = page.getByRole('dialog', { name: 'Move money' })
  await expect(move).toBeVisible()
  await move.getByLabel('From').selectOption({ label: /Groceries/ })
  await move.getByLabel('To').selectOption({ label: /Dining out/ })
  await move.getByLabel('Amount').fill('200')
  await move.getByRole('button', { name: 'Move' }).click()
  await expect(move).toBeHidden()

  await page.getByRole('button', { name: 'Recent Moves' }).click()
  await expect(page.getByRole('heading', { name: 'Recent Moves' })).toBeVisible()
})

test('weekly and yearly targets and backup v2 round trip', async ({ page }) => {
  await addAccount(page, 'Cadence Cash', '50000')

  await selectCategory(page, 'Groceries')
  let inspector = page.getByRole('complementary', { name: 'Inspector' })
  await inspector.getByRole('button', { name: /Add target|Edit target/ }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Weekly').check()
  await dialog.getByLabel('Amount').fill('1000')
  await dialog.getByLabel('Week starts on').selectOption({ label: 'Saturday' })
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()

  await selectCategory(page, 'Dining out')
  inspector = page.getByRole('complementary', { name: 'Inspector' })
  await inspector.getByRole('button', { name: /Add target|Edit target/ }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Yearly').check()
  await dialog.getByLabel('Amount').fill('12000')
  await dialog.getByLabel('By month').fill('2027-06')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()

  await page.goto('/settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloadPromise
  const path = join(tmpdir(), `kaban-ma-${Date.now()}.json`)
  await download.saveAs(path)
  const exported = JSON.parse(readFileSync(path, 'utf8')) as {
    version: number
    targets?: unknown[]
    accounts: unknown[]
    categoryGroups: unknown[]
    categories: unknown[]
    payees: unknown[]
    transactions: unknown[]
    assignments: unknown[]
    pins: unknown[]
    budgets: unknown[]
    exportedAt: string
  }
  expect(exported.version).toBe(2)
  expect((exported.targets ?? []).length).toBeGreaterThan(0)

  const v1Path = join(tmpdir(), `kaban-v1-${Date.now()}.json`)
  writeFileSync(
    v1Path,
    JSON.stringify({
      version: 1,
      exportedAt: exported.exportedAt,
      budgets: exported.budgets,
      accounts: exported.accounts,
      categoryGroups: exported.categoryGroups,
      categories: exported.categories,
      payees: exported.payees,
      transactions: exported.transactions,
      assignments: exported.assignments,
      pins: exported.pins,
    }),
  )

  let dialogStep = 0
  page.on('dialog', async (d) => {
    if (dialogStep === 0) {
      dialogStep += 1
      await d.dismiss()
    } else {
      await d.accept()
    }
  })
  await page.locator('label.file-label input[type="file"]').setInputFiles(v1Path)
  await expect(page.getByRole('status')).toContainText('Backup imported.', { timeout: 15_000 })

  unlinkSync(path)
  unlinkSync(v1Path)
})
