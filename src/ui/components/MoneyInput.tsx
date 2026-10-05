import { useEffect, useReducer } from 'react'
import type { Centavos } from '../../domain/money.ts'
import { Field } from './Field.tsx'
import { initialMoneyField, moneyErrorMessage, reduceMoneyField } from './moneyField.ts'

export function MoneyInput({
  label,
  value,
  onChange,
  required = false,
  hint,
  name,
}: {
  label: string
  value: Centavos | null
  onChange: (c: Centavos | null) => void
  required?: boolean
  hint?: string
  name?: string
}) {
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof initialMoneyField>, e: Parameters<typeof reduceMoneyField>[1]) =>
      reduceMoneyField(s, e, required),
    initialMoneyField(value === null ? '' : String(value / 100)),
  )

  useEffect(() => {
    onChange(state.centavos)
  }, [state.centavos, onChange])

  return (
    <Field label={label} hint={hint} error={state.error ? moneyErrorMessage[state.error] : null}>
      {(control) => (
        <input
          {...control}
          className="field-control"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          name={name}
          value={state.text}
          onChange={(e) => dispatch({ type: 'input', text: e.target.value })}
          onBlur={() => dispatch({ type: 'blur' })}
        />
      )}
    </Field>
  )
}
