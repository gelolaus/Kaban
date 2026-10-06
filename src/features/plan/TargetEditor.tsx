import { useEffect, useId, useRef, useState } from 'react'
import type { Centavos } from '../../domain/money.ts'
import type {
  EngineTarget,
  TargetBehavior,
  TargetCadence,
  TargetRepeat,
} from '../../engine/types.ts'
import { Button } from '../../ui/components/Button.tsx'
import { Field } from '../../ui/components/Field.tsx'
import { MoneyInput } from '../../ui/components/MoneyInput.tsx'
import { behaviorsForCadence, behaviorLabel, targetPlainSummary } from './targetCopy.ts'
import './plan.css'

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const

export interface TargetEditorProps {
  open: boolean
  categoryId: string
  categoryName: string
  existing: EngineTarget | null
  onClose: () => void
  onSave: (input: {
    categoryId: string
    cadence: TargetCadence
    behavior: TargetBehavior
    amountCentavos: number
    weekday?: number | null
    dueDay?: number | 'end' | null
    dueMonth?: string | null
    repeat?: TargetRepeat | null
    repeatBehavior?: 'set_aside' | 'refill' | null
  }) => Promise<void>
  onDelete?: () => Promise<void>
}

function defaultsFrom(existing: EngineTarget | null) {
  if (!existing) {
    return {
      cadence: 'monthly' as const,
      behavior: 'refill' as const,
      amount: null as Centavos | null,
      weekday: 1,
      dueDay: 'end',
      dueMonth: '',
      repeat: 'none' as TargetRepeat,
      repeatBehavior: 'set_aside' as const,
    }
  }
  return {
    cadence: existing.cadence,
    behavior: existing.behavior,
    amount: existing.amount as Centavos,
    weekday: existing.weekday ?? 1,
    dueDay:
      existing.dueDay === undefined
        ? 'end'
        : existing.dueDay === 'end'
          ? 'end'
          : String(existing.dueDay),
    dueMonth: existing.dueMonth ?? '',
    repeat: (existing.repeat ?? 'none') as TargetRepeat,
    repeatBehavior: (existing.repeatBehavior ?? 'set_aside') as 'set_aside' | 'refill',
  }
}

function TargetEditorForm({
  categoryId,
  categoryName,
  existing,
  onClose,
  onSave,
  onDelete,
  closeDialog,
}: Omit<TargetEditorProps, 'open'> & { closeDialog: () => void }) {
  const seed = defaultsFrom(existing)
  const [cadence, setCadence] = useState<TargetCadence>(seed.cadence)
  const [behavior, setBehavior] = useState<TargetBehavior>(() => {
    const allowed = behaviorsForCadence(seed.cadence)
    return allowed.includes(seed.behavior) ? seed.behavior : allowed[0]!
  })
  const [amount, setAmount] = useState<Centavos | null>(seed.amount)
  const [weekday, setWeekday] = useState(seed.weekday)
  const [dueDay, setDueDay] = useState(seed.dueDay)
  const [dueMonth, setDueMonth] = useState(seed.dueMonth)
  const [repeat, setRepeat] = useState<TargetRepeat>(seed.repeat)
  const [repeatBehavior, setRepeatBehavior] = useState<'set_aside' | 'refill'>(seed.repeatBehavior)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allowedBehaviors = behaviorsForCadence(cadence)
  const effectiveBehavior = allowedBehaviors.includes(behavior) ? behavior : allowedBehaviors[0]!

  const summary = targetPlainSummary({
    cadence,
    behavior: effectiveBehavior,
    amount,
    weekday,
    dueDay: dueDay === 'end' ? 'end' : Number(dueDay),
    dueMonth: dueMonth || null,
    repeat: cadence === 'custom' ? repeat : null,
  })

  async function handleSave() {
    if (amount === null || amount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (
      (cadence === 'yearly' || (cadence === 'custom' && effectiveBehavior !== 'balance')) &&
      !dueMonth
    ) {
      setError('Choose a due month.')
      return
    }
    if (cadence === 'custom' && effectiveBehavior === 'balance' && repeat !== 'none') {
      setError('A balance target cannot repeat.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        categoryId,
        cadence,
        behavior: effectiveBehavior,
        amountCentavos: amount,
        weekday: cadence === 'weekly' ? weekday : null,
        dueDay: cadence === 'monthly' ? (dueDay === 'end' ? 'end' : Number(dueDay)) : null,
        dueMonth: cadence === 'yearly' || cadence === 'custom' ? dueMonth || null : null,
        repeat: cadence === 'custom' ? (effectiveBehavior === 'balance' ? 'none' : repeat) : null,
        repeatBehavior:
          cadence === 'custom' && effectiveBehavior === 'set_aside' && repeat !== 'none'
            ? repeatBehavior
            : null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save target.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sheet-body plan-dialog-body">
      <p className="ink-2">{categoryName}</p>

      <fieldset className="plan-fieldset">
        <legend>Cadence</legend>
        <div className="plan-chip-row" role="radiogroup" aria-label="Cadence">
          {(['weekly', 'monthly', 'yearly', 'custom'] as const).map((c) => (
            <label key={c} className="plan-radio-chip">
              <input
                type="radio"
                name="target-cadence"
                checked={cadence === c}
                onChange={() => {
                  setCadence(c)
                  const next = behaviorsForCadence(c)
                  if (!next.includes(behavior)) setBehavior(next[0]!)
                }}
              />
              <span>{c[0]!.toUpperCase() + c.slice(1)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <MoneyInput
        label="Amount"
        value={amount}
        onChange={setAmount}
        name="target-amount"
        required
      />

      <Field label="Behavior">
        {(control) => (
          <select
            {...control}
            className="field-control"
            name="target-behavior"
            value={effectiveBehavior}
            onChange={(e) => setBehavior(e.target.value as TargetBehavior)}
          >
            {allowedBehaviors.map((b) => (
              <option key={b} value={b}>
                {behaviorLabel(b, cadence)}
              </option>
            ))}
          </select>
        )}
      </Field>

      {cadence === 'weekly' ? (
        <Field label="Week starts on">
          {(control) => (
            <select
              {...control}
              className="field-control"
              name="target-weekday"
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
            >
              {WEEKDAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : null}

      {cadence === 'monthly' ? (
        <Field label="Due by">
          {(control) => (
            <select
              {...control}
              className="field-control"
              name="target-due-day"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            >
              <option value="end">End of month</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : null}

      {cadence === 'yearly' || cadence === 'custom' ? (
        <Field label={cadence === 'yearly' ? 'By month' : 'Due on (month)'}>
          {(control) => (
            <input
              {...control}
              className="field-control"
              name="target-due-month"
              type="month"
              value={dueMonth}
              onChange={(e) => setDueMonth(e.target.value)}
              required={!(cadence === 'custom' && effectiveBehavior === 'balance')}
            />
          )}
        </Field>
      ) : null}

      {cadence === 'custom' && effectiveBehavior !== 'balance' ? (
        <Field label="Repeat">
          {(control) => (
            <select
              {...control}
              className="field-control"
              name="target-repeat"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as TargetRepeat)}
            >
              <option value="none">Does not repeat</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          )}
        </Field>
      ) : null}

      {cadence === 'custom' && effectiveBehavior === 'set_aside' && repeat !== 'none' ? (
        <Field label="After the first period">
          {(control) => (
            <select
              {...control}
              className="field-control"
              name="target-repeat-behavior"
              value={repeatBehavior}
              onChange={(e) => setRepeatBehavior(e.target.value as 'set_aside' | 'refill')}
            >
              <option value="set_aside">Set aside another</option>
              <option value="refill">Refill up to</option>
            </select>
          )}
        </Field>
      ) : null}

      <p className="plan-target-summary" aria-live="polite">
        {summary}
      </p>
      {error ? (
        <p className="field-error" role="status">
          {error}
        </p>
      ) : null}

      <div className="plan-dialog-actions">
        <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
          Save
        </Button>
        {existing && onDelete ? (
          <Button
            onClick={() => {
              if (!window.confirm('Delete this target?')) return
              void onDelete().then(onClose)
            }}
          >
            Delete
          </Button>
        ) : null}
        <Button variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function TargetEditor({
  open,
  categoryId,
  categoryName,
  existing,
  onClose,
  onSave,
  onDelete,
}: TargetEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="sheet plan-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <div className="sheet-header">
        <h2 id={titleId}>{existing ? 'Edit target' : 'Add target'}</h2>
        <Button variant="ghost" onClick={() => dialogRef.current?.close()} aria-label="Close">
          Close
        </Button>
      </div>
      {open ? (
        <TargetEditorForm
          key={`${categoryId}-${existing?.amount ?? 'new'}-${existing?.cadence ?? 'none'}`}
          categoryId={categoryId}
          categoryName={categoryName}
          existing={existing}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
          closeDialog={() => dialogRef.current?.close()}
        />
      ) : null}
    </dialog>
  )
}
