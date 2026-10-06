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

async function addAccount(
  page: Page,
  name: string,
  type: 'Checking' | 'Credit card',
  balance: string,
) {
  await page.goto('/accounts')
  await page.getByRole('button', { name: 'Add account' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByLabel(type).check()
  await page.getByLabel('Starting balance').fill(balance)
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

async function openNewTx(page: Page) {
  await page.getByRole('button', { name: 'Transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog).toBeVisible()
  return dialog
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await waitReady(page)
})

test('edit and delete a transaction', async ({ page }) => {
  await addAccount(page, 'Cash A', 'Checking', '5000')
  const dialog = await openNewTx(page)
  await dialog.getByRole('button', { name: 'Outflow' }).click()
  await dialog.getByLabel('Amount').fill('250')
  await dialog.getByLabel('Payee').fill('EditMe')
  await dialog.getByLabel('Category').selectOption({ label: 'Groceries' })
  await dialog.getByLabel('Account', { exact: true }).selectOption({ label: 'Cash A' })
  await dialog.getByRole('button', { name: 'Save transaction' }).click()
  await expect(dialog).toBeHidden()

  await page.goto('/spending')
  await page.getByRole('button', { name: /EditMe/ }).click()
  const edit = page.getByRole('dialog', { name: 'Edit transaction' })
  await expect(edit).toBeVisible()
  await edit.getByLabel('Amount').fill('300')
  await edit.getByLabel('Payee').fill('Edited')
  await edit.getByRole('button', { name: 'Save transaction' }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByText('Edited')).toBeVisible()

  await page.getByRole('button', { name: /Edited/ }).click()
  await expect(edit).toBeVisible()
  await edit.getByRole('button', { name: 'Delete transaction' }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByText('Edited')).toHaveCount(0)
})

test('create edit and delete a transfer keeps accounts consistent', async ({ page }) => {
  await addAccount(page, 'Wallet T', 'Checking', '8000')
  await addAccount(page, 'Savings T', 'Checking', '2000')

  await page.goto('/accounts')
  await expect(page.locator('.account-list').getByText('Wallet T')).toBeVisible()

  const dialog = await openNewTx(page)
  await dialog.getByRole('button', { name: 'Transfer' }).click()
  await dialog.getByLabel('Amount').fill('1500')
  await dialog.getByLabel('Account', { exact: true }).selectOption({ label: 'Wallet T' })
  await dialog.getByLabel('To account').selectOption({ label: 'Savings T' })
  await dialog.getByRole('button', { name: 'Save transaction' }).click()
  await expect(dialog).toBeHidden()

  await page.goto('/accounts')
  await expect(page.locator('.account-list').getByText('Wallet T').locator('..')).toContainText(
    '₱6,500.00',
  )
  await expect(page.locator('.account-list').getByText('Savings T').locator('..')).toContainText(
    '₱3,500.00',
  )

  await page.goto('/spending')
  await page
    .getByRole('button', { name: /Transfer/ })
    .first()
    .click()
  const edit = page.getByRole('dialog', { name: 'Edit transaction' })
  await expect(edit).toBeVisible()
  await edit.getByLabel('Amount').fill('1000')
  await edit.getByRole('button', { name: 'Save transaction' }).click()
  await expect(edit).toBeHidden()

  await page.goto('/accounts')
  await expect(page.locator('.account-list').getByText('Wallet T').locator('..')).toContainText(
    '₱7,000.00',
  )
  await expect(page.locator('.account-list').getByText('Savings T').locator('..')).toContainText(
    '₱3,000.00',
  )

  await page.goto('/spending')
  await page
    .getByRole('button', { name: /Transfer/ })
    .first()
    .click()
  await expect(edit).toBeVisible()
  await edit.getByRole('button', { name: 'Delete transaction' }).click()
  await expect(edit).toBeHidden()

  await page.goto('/accounts')
  await expect(page.locator('.account-list').getByText('Wallet T').locator('..')).toContainText(
    '₱8,000.00',
  )
  await expect(page.locator('.account-list').getByText('Savings T').locator('..')).toContainText(
    '₱2,000.00',
  )
})

test('card payment moves money to the card', async ({ page }) => {
  await addAccount(page, 'Pay Wallet', 'Checking', '5000')
  await addAccount(page, 'Pay Card', 'Credit card', '0')

  // spend on card
  let dialog = await openNewTx(page)
  await dialog.getByRole('button', { name: 'Outflow' }).click()
  await dialog.getByLabel('Amount').fill('800')
  await dialog.getByLabel('Payee').fill('Shop')
  await dialog.getByLabel('Category').selectOption({ label: 'Dining out' })
  await dialog.getByLabel('Account', { exact: true }).selectOption({ label: 'Pay Card' })
  await dialog.getByRole('button', { name: 'Save transaction' }).click()
  await expect(dialog).toBeHidden()

  // pay the card from wallet
  dialog = await openNewTx(page)
  await dialog.getByRole('button', { name: 'Transfer' }).click()
  await dialog.getByLabel('Amount').fill('800')
  await dialog.getByLabel('Account', { exact: true }).selectOption({ label: 'Pay Wallet' })
  await dialog.getByLabel('To account').selectOption({ label: 'Pay Card' })
  await dialog.getByRole('button', { name: 'Save transaction' }).click()
  await expect(dialog).toBeHidden()

  await page.goto('/accounts')
  await expect(page.locator('.account-list').getByText('Pay Wallet').locator('..')).toContainText(
    '₱4,200.00',
  )
  await expect(page.locator('.account-list').getByText('Pay Card').locator('..')).toContainText(
    '₱0.00',
  )
})

test('backup export import round trip and corrupt file leaves data', async ({ page }) => {
  await addAccount(page, 'Backup Cash', 'Checking', '1234')
  await page.goto('/settings')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloadPromise
  const path = join(tmpdir(), `kaban-test-${Date.now()}.json`)
  await download.saveAs(path)
  const exported = JSON.parse(readFileSync(path, 'utf8')) as { accounts: unknown[] }
  expect(exported.accounts.length).toBeGreaterThan(0)

  const bad = join(tmpdir(), `kaban-bad-${Date.now()}.json`)
  writeFileSync(bad, '{"version":1}')
  await page.locator('label.file-label input[type="file"]').setInputFiles(bad)
  await expect(page.getByRole('status')).toContainText(/Backup is missing|Unsupported backup/i, {
    timeout: 10_000,
  })
  await page.goto('/accounts')
  await expect(page.locator('.account-list').getByText('Backup Cash')).toBeVisible()

  await page.goto('/settings')
  let dialogStep = 0
  page.on('dialog', async (d) => {
    if (dialogStep === 0) {
      dialogStep += 1
      await d.dismiss()
    } else {
      await d.accept()
    }
  })
  await page.locator('label.file-label input[type="file"]').setInputFiles(path)
  await expect(page.getByRole('status')).toContainText('Backup imported.', { timeout: 15_000 })
  await page.goto('/accounts')
  await expect(page.locator('.account-list').getByText('Backup Cash')).toBeVisible()

  unlinkSync(path)
  unlinkSync(bad)
})

test('category rename hide reorder and pin', async ({ page }) => {
  await page.goto('/plan')
  await page.getByRole('button', { name: 'Groceries' }).click()
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await expect(inspector.getByRole('heading', { name: 'Groceries' })).toBeVisible()

  await inspector.getByLabel('Rename').fill('Food shop')
  await inspector.getByRole('button', { name: 'Rename category' }).click()
  await expect(page.getByRole('button', { name: 'Food shop' })).toBeVisible()

  await page.getByRole('button', { name: 'Food shop' }).click()
  await inspector.getByRole('button', { name: 'Move down' }).click()
  await page.getByRole('button', { name: 'Food shop' }).click()
  await inspector.getByRole('button', { name: 'Pin to Home' }).click()
  await expect(inspector.getByRole('button', { name: 'Unpin from Home' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/home')
  await expect(page.getByText('Food shop')).toBeVisible({ timeout: 15_000 })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/plan')
  await page.getByRole('button', { name: 'Food shop' }).click()
  await inspector.getByRole('button', { name: 'Hide category' }).click()
  await expect(page.getByRole('button', { name: 'Food shop' })).toHaveCount(0)
})

test('remove data from this device', async ({ page }) => {
  await addAccount(page, 'Doomed', 'Checking', '50')
  await page.goto('/settings')
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Remove data from this device' }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 60_000 })
  await page.getByRole('link', { name: 'All accounts' }).click()
  await expect(page.locator('.account-list').getByText('Doomed')).toHaveCount(0)
})
