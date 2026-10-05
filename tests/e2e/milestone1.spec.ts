import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

async function waitReady(page: import('@playwright/test').Page) {
  await page.goto('/plan')
  await expect(
    page.getByTestId('ready-to-assign').or(page.getByTestId('ready-to-assign-phone')),
  ).toBeVisible({
    timeout: 60_000,
  })
}

test('G1 to G4 golden budget flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await waitReady(page)

  // Create cash wallet with 10,000.00 starting balance (G1)
  await page.goto('/accounts')
  await page.getByRole('button', { name: 'Add account' }).click()
  await page.getByLabel('Name').fill('Test Wallet')
  await page.getByLabel('Checking').check()
  await page.getByLabel('Starting balance').fill('10000')
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(page.getByText('Test Wallet')).toBeVisible()

  await page.goto('/plan')
  await expect(page.getByTestId('ready-to-assign')).toContainText('₱10,000.00')

  // G2: assign 3000 groceries, 1000 dining
  const groc = page.getByRole('button', { name: 'Groceries' })
  await groc.click()
  await page.getByLabel('Assign').fill('3000')
  await page.getByRole('button', { name: 'Save assignment' }).click()
  await page.getByRole('button', { name: 'Dining out' }).click()
  await page.getByLabel('Assign').fill('1000')
  await page.getByRole('button', { name: 'Save assignment' }).click()
  await expect(page.getByTestId('ready-to-assign')).toContainText('₱6,000.00')

  // G3: spend 3500 cash on groceries
  await page.getByRole('button', { name: 'Transaction' }).click()
  const dialog = page.getByRole('dialog', { name: 'New transaction' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Outflow' }).click()
  await dialog.getByLabel('Amount').fill('3500')
  await dialog.getByLabel('Payee').fill('Market')
  await dialog.getByLabel('Category').selectOption({ label: 'Groceries' })
  await dialog.getByLabel('Account').selectOption({ label: 'Test Wallet' })
  await dialog.getByRole('button', { name: 'Save transaction' }).click()
  await expect(dialog).toBeHidden()

  await page.goto('/plan')
  await page.getByRole('button', { name: 'Groceries' }).click()
  await expect(page.getByText('−₱500.00').first()).toBeVisible()
  await expect(page.getByTestId('ready-to-assign')).toContainText('₱6,000.00')

  // Create credit card and G4 spend
  await page.goto('/accounts')
  await page.getByRole('button', { name: 'Add account' }).click()
  await page.getByLabel('Name').fill('Test Card')
  await page.getByLabel('Credit card').check()
  await page.getByLabel('Starting balance').fill('0')
  await page.getByRole('button', { name: 'Save account' }).click()

  await page.getByRole('button', { name: 'Transaction' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Outflow' }).click()
  await dialog.getByLabel('Amount').fill('1200')
  await dialog.getByLabel('Payee').fill('Cafe')
  await dialog.getByLabel('Category').selectOption({ label: 'Dining out' })
  await dialog.getByLabel('Account').selectOption({ label: 'Test Card' })
  await dialog.getByRole('button', { name: 'Save transaction' }).click()

  await page.goto('/plan')
  await expect(page.getByTestId('ready-to-assign')).toContainText('₱6,000.00')
  await page.getByRole('button', { name: 'Dining out' }).click()
  await expect(page.getByText('−₱200.00').first()).toBeVisible()
})

test('axe plan and accounts light and dark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await waitReady(page)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.goto('/accounts')
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.goto('/spending')
    await expect(page.getByRole('heading', { name: 'Spending' })).toBeVisible()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  }
})
