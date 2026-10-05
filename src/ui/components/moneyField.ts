import { parseMoney, type Centavos, type MoneyParseError } from '../../domain/money.ts'

export interface MoneyFieldState {
  text: string
  centavos: Centavos | null
  error: MoneyParseError | null
}

export type MoneyFieldEvent = { type: 'input'; text: string } | { type: 'blur' }

export function initialMoneyField(text = ''): MoneyFieldState {
  return { text, centavos: null, error: null }
}

export function reduceMoneyField(
  state: MoneyFieldState,
  event: MoneyFieldEvent,
  required: boolean,
): MoneyFieldState {
  if (event.type === 'input') {
    const parsed = parseMoney(event.text)
    return {
      text: event.text,
      centavos: parsed.ok ? parsed.value : null,
      error: null,
    }
  }

  const trimmed = state.text.trim()
  if (trimmed.length === 0) {
    return {
      text: state.text,
      centavos: null,
      error: required ? 'empty' : null,
    }
  }
  const parsed = parseMoney(state.text)
  if (parsed.ok) {
    return { text: state.text, centavos: parsed.value, error: null }
  }
  return { text: state.text, centavos: null, error: parsed.error }
}

export const moneyErrorMessage: Record<MoneyParseError, string> = {
  empty: 'Enter an amount.',
  invalid: 'Use numbers like 1,200.50.',
  negative: 'Enter an amount above zero.',
  too_many_decimals: 'Use at most two decimal places.',
  too_large: 'That amount is too large.',
}

export function shouldSubmitOnEnter(e: {
  key: string
  isComposing: boolean
  shiftKey?: boolean
}): boolean {
  return e.key === 'Enter' && !e.isComposing && !e.shiftKey
}
