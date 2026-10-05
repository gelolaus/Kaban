import { describe, expect, test } from 'vitest'
import { BackupValidationError, parseBackupPayload } from './backupValidate.ts'

const base = {
  version: 1 as const,
  exportedAt: '2026-10-05T00:00:00.000Z',
  budgets: [
    {
      id: 'b1',
      name: 'Kaban',
      currency: 'PHP',
      created_at: 't',
      updated_at: 't',
      deleted_at: null,
    },
  ],
  accounts: [],
  categoryGroups: [],
  categories: [],
  payees: [],
  transactions: [],
  assignments: [],
  pins: [],
}

describe('parseBackupPayload', () => {
  test('accepts a minimal valid payload', () => {
    expect(parseBackupPayload(base).version).toBe(1)
  })

  test('rejects missing arrays', () => {
    const rest = { ...base }
    delete (rest as { accounts?: unknown }).accounts
    expect(() => parseBackupPayload(rest)).toThrow(BackupValidationError)
  })

  test('rejects unsafe amounts', () => {
    expect(() =>
      parseBackupPayload({
        ...base,
        transactions: [
          {
            id: 't1',
            budget_id: 'b1',
            account_id: 'a1',
            date: '2026-10-05',
            payee_id: null,
            category_id: null,
            memo: null,
            amount_centavos: Number.MAX_SAFE_INTEGER + 1,
            cleared: 'cleared',
            approved: 1,
            transfer_transaction_id: null,
            created_at: 't',
            updated_at: 't',
            deleted_at: null,
          },
        ],
      }),
    ).toThrow(/safe integer/)
  })

  test('rejects duplicate ids', () => {
    expect(() =>
      parseBackupPayload({
        ...base,
        accounts: [
          {
            id: 'a1',
            budget_id: 'b1',
            name: 'One',
            type: 'checking',
            on_budget: 1,
            closed: 0,
            sort_order: 0,
            note: null,
            created_at: 't',
            updated_at: 't',
            deleted_at: null,
          },
          {
            id: 'a1',
            budget_id: 'b1',
            name: 'Two',
            type: 'checking',
            on_budget: 1,
            closed: 0,
            sort_order: 1,
            note: null,
            created_at: 't',
            updated_at: 't',
            deleted_at: null,
          },
        ],
      }),
    ).toThrow(/Duplicate/)
  })

  test('rejects invalid dates', () => {
    expect(() =>
      parseBackupPayload({
        ...base,
        transactions: [
          {
            id: 't1',
            budget_id: 'b1',
            account_id: 'a1',
            date: '2026-02-30',
            payee_id: null,
            category_id: null,
            memo: null,
            amount_centavos: 100,
            cleared: 'cleared',
            approved: 1,
            transfer_transaction_id: null,
            created_at: 't',
            updated_at: 't',
            deleted_at: null,
          },
        ],
      }),
    ).toThrow(/invalid date/)
  })
})
