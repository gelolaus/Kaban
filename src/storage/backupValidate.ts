import type { BackupPayload } from './types.ts'

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupValidationError'
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function requireArray(payload: Record<string, unknown>, key: string): unknown[] {
  const v = payload[key]
  if (!Array.isArray(v)) {
    throw new BackupValidationError(`Backup is missing the ${key} list.`)
  }
  return v
}

function requireSafeInt(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new BackupValidationError(`${label} must be a safe integer.`)
  }
  return value
}

function requireId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BackupValidationError(`${label} is missing an id.`)
  }
  return value
}

function requireDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    throw new BackupValidationError(`${label} has an invalid date.`)
  }
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m! - 1 || dt.getUTCDate() !== d) {
    throw new BackupValidationError(`${label} has an invalid date.`)
  }
  return value
}

function collectUniqueIds(ids: string[], label: string): void {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      throw new BackupValidationError(`Duplicate ${label} id "${id}".`)
    }
    seen.add(id)
  }
}

/** Validate unknown JSON as a BackupPayload without mutating storage. */
export function parseBackupPayload(raw: unknown): BackupPayload {
  if (!isRecord(raw)) {
    throw new BackupValidationError('Backup file is not a JSON object.')
  }
  if (raw.version !== 1) {
    throw new BackupValidationError('Unsupported backup version.')
  }
  if (typeof raw.exportedAt !== 'string' || raw.exportedAt.length === 0) {
    throw new BackupValidationError('Backup is missing exportedAt.')
  }

  const budgets = requireArray(raw, 'budgets')
  const accounts = requireArray(raw, 'accounts')
  const categoryGroups = requireArray(raw, 'categoryGroups')
  const categories = requireArray(raw, 'categories')
  const payees = requireArray(raw, 'payees')
  const transactions = requireArray(raw, 'transactions')
  const assignments = requireArray(raw, 'assignments')
  const pins = requireArray(raw, 'pins')

  const budgetIds: string[] = []
  for (const [i, row] of budgets.entries()) {
    if (!isRecord(row)) throw new BackupValidationError(`Budget ${i + 1} is invalid.`)
    budgetIds.push(requireId(row.id, `Budget ${i + 1}`))
  }
  collectUniqueIds(budgetIds, 'budget')

  const accountIds: string[] = []
  for (const [i, row] of accounts.entries()) {
    if (!isRecord(row)) throw new BackupValidationError(`Account ${i + 1} is invalid.`)
    accountIds.push(requireId(row.id, `Account ${i + 1}`))
  }
  collectUniqueIds(accountIds, 'account')

  const groupIds: string[] = []
  for (const [i, row] of categoryGroups.entries()) {
    if (!isRecord(row)) throw new BackupValidationError(`Category group ${i + 1} is invalid.`)
    groupIds.push(requireId(row.id, `Category group ${i + 1}`))
  }
  collectUniqueIds(groupIds, 'category group')

  const categoryIds: string[] = []
  for (const [i, row] of categories.entries()) {
    if (!isRecord(row)) throw new BackupValidationError(`Category ${i + 1} is invalid.`)
    categoryIds.push(requireId(row.id, `Category ${i + 1}`))
  }
  collectUniqueIds(categoryIds, 'category')

  const payeeIds: string[] = []
  for (const [i, row] of payees.entries()) {
    if (!isRecord(row)) throw new BackupValidationError(`Payee ${i + 1} is invalid.`)
    payeeIds.push(requireId(row.id, `Payee ${i + 1}`))
  }
  collectUniqueIds(payeeIds, 'payee')

  const txIds: string[] = []
  for (const [i, row] of transactions.entries()) {
    if (!isRecord(row)) throw new BackupValidationError(`Transaction ${i + 1} is invalid.`)
    txIds.push(requireId(row.id, `Transaction ${i + 1}`))
    requireSafeInt(row.amount_centavos, `Transaction ${i + 1} amount`)
    requireDate(row.date, `Transaction ${i + 1}`)
  }
  collectUniqueIds(txIds, 'transaction')

  const assignmentIds: string[] = []
  for (const [i, row] of assignments.entries()) {
    if (!isRecord(row)) throw new BackupValidationError(`Assignment ${i + 1} is invalid.`)
    assignmentIds.push(requireId(row.id, `Assignment ${i + 1}`))
    requireSafeInt(row.delta_centavos, `Assignment ${i + 1} amount`)
    if (typeof row.month !== 'string' || !ISO_MONTH.test(row.month)) {
      throw new BackupValidationError(`Assignment ${i + 1} has an invalid month.`)
    }
  }
  collectUniqueIds(assignmentIds, 'assignment')

  const pinIds: string[] = []
  for (const [i, row] of pins.entries()) {
    if (!isRecord(row)) throw new BackupValidationError(`Pin ${i + 1} is invalid.`)
    pinIds.push(requireId(row.id, `Pin ${i + 1}`))
  }
  collectUniqueIds(pinIds, 'pin')

  return raw as unknown as BackupPayload
}

export function backupReplaceSummary(payload: BackupPayload): string {
  return [
    `${payload.accounts.length} accounts`,
    `${payload.categories.length} categories`,
    `${payload.transactions.length} transactions`,
    `${payload.assignments.length} assignments`,
  ].join(', ')
}
