import { formatMoney } from '../../domain/money.ts'
import type {
  EngineTarget,
  TargetBehavior,
  TargetCadence,
  TargetRepeat,
} from '../../engine/types.ts'

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export function behaviorLabel(behavior: TargetBehavior, cadence: TargetCadence): string {
  if (behavior === 'set_aside') return 'Set aside another'
  if (behavior === 'balance') return 'Have a balance of'
  if (cadence === 'custom') return 'Fill up to'
  return 'Refill up to'
}

export function behaviorsForCadence(cadence: TargetCadence): TargetBehavior[] {
  if (cadence === 'custom') return ['set_aside', 'refill', 'balance']
  return ['set_aside', 'refill']
}

function dayOrdinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

export function dueDayLabel(dueDay: number | 'end' | undefined): string {
  if (dueDay === undefined || dueDay === 'end') return 'the end of the month'
  return `the ${dayOrdinal(dueDay)}`
}

export function targetPlainSummary(partial: {
  cadence: TargetCadence
  behavior: TargetBehavior
  amount: number | null
  weekday?: number | null
  dueDay?: number | 'end' | null
  dueMonth?: string | null
  repeat?: TargetRepeat | null
}): string {
  if (partial.amount === null || partial.amount <= 0) {
    return 'Enter an amount to see what this target will ask each month.'
  }
  const money = formatMoney(partial.amount)
  const verb = behaviorLabel(partial.behavior, partial.cadence)

  if (partial.cadence === 'weekly') {
    const day = WEEKDAYS[partial.weekday ?? 0] ?? 'Sunday'
    return `${verb} ${money} each week starting on ${day}.`
  }
  if (partial.cadence === 'monthly') {
    const by =
      partial.dueDay === undefined || partial.dueDay === null
        ? 'the end of the month'
        : dueDayLabel(partial.dueDay)
    return `${verb} ${money} every month by ${by}.`
  }
  if (partial.cadence === 'yearly') {
    const by = partial.dueMonth ? `by ${partial.dueMonth}` : 'by the chosen month'
    return `${verb} ${money} each year ${by}.`
  }
  const due = partial.dueMonth ? `due ${partial.dueMonth}` : 'with no due date'
  if (partial.behavior === 'balance' && !partial.dueMonth) {
    return `Have a balance of ${money} (no due date).`
  }
  const repeat = partial.repeat && partial.repeat !== 'none' ? `, repeating ${partial.repeat}` : ''
  return `${verb} ${money} ${due}${repeat}.`
}

export function neededCaption(needed: number, target: EngineTarget | undefined): string | null {
  if (needed <= 0 || !target) return null
  const money = formatMoney(needed)
  if (target.cadence === 'monthly') {
    return `${money} more needed by ${dueDayLabel(target.dueDay)}`
  }
  if (target.cadence === 'weekly') {
    const day = WEEKDAYS[target.weekday ?? 0] ?? 'Sunday'
    return `${money} more needed this month (${day} weekly)`
  }
  if (target.dueMonth) {
    return `${money} more needed toward ${target.dueMonth}`
  }
  return `${money} more needed`
}

export function settingValue(
  settings: { key: string; value: string }[],
  key: string,
): string | null {
  return settings.find((s) => s.key === key)?.value ?? null
}
