import { useEffect, useId, useRef, useState } from 'react'
import type { Centavos } from '../../domain/money.ts'
import { formatMoney } from '../../domain/money.ts'
import { moveMoneyPreview } from '../../engine/autoAssign.ts'
import type { BudgetSnapshot } from '../../engine/types.ts'
import { Button } from '../../ui/components/Button.tsx'
import { Field } from '../../ui/components/Field.tsx'
import { MoneyInput } from '../../ui/components/MoneyInput.tsx'
import './plan.css'

const RTA = '__rta__'

function MoveMoneyBody({
  snapshot,
  month,
  categories,
  coverTargets,
  defaultToId,
  onSave,
  onClose,
}: {
  snapshot: BudgetSnapshot
  month: string
  categories: { id: string; name: string }[]
  coverTargets: { categoryId: string; amount: number }[]
  defaultToId?: string | null
  onSave: (input: {
    fromCategoryId: string | null
    toCategoryId: string | null
    amount: number
    kind: 'move' | 'cover'
  }) => Promise<void>
  onClose: () => void
}) {
  const [fromId, setFromId] = useState(RTA)
  const [toId, setToId] = useState(defaultToId ?? '')
  const [amount, setAmount] = useState<Centavos | null>(null)
  const [coverMode, setCoverMode] = useState(false)
  const [coverIndex, setCoverIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeCover = coverMode ? coverTargets[coverIndex] : null
  const displayToId = activeCover ? activeCover.categoryId : toId
  const displayAmount = amount

  async function handleSave() {
    const amountToUse = displayAmount
    if (amountToUse === null || amountToUse <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    const from = fromId === RTA ? null : fromId
    const to = displayToId === RTA ? null : displayToId || null
    if (from === to) {
      setError('Choose different From and To.')
      return
    }
    if (!from && !to) {
      setError('Choose at least one category.')
      return
    }
    const preview = moveMoneyPreview(snapshot, month, from, to, amountToUse)
    if (preview.deltas.length === 0) {
      setError('Nothing to move with that amount and source.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        fromCategoryId: from,
        toCategoryId: to,
        amount: amountToUse,
        kind: coverMode ? 'cover' : 'move',
      })
      if (coverMode && coverIndex < coverTargets.length - 1) {
        const next = coverIndex + 1
        setCoverIndex(next)
        setAmount((coverTargets[next]?.amount ?? null) as Centavos | null)
      } else {
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {coverTargets.length > 0 && !coverMode ? (
        <div className="plan-cover-banner" role="status">
          <p>
            Cover {coverTargets.length} overspent{' '}
            {coverTargets.length === 1 ? 'category' : 'categories'}
          </p>
          <Button
            onClick={() => {
              setCoverMode(true)
              setCoverIndex(0)
              setFromId(RTA)
              setAmount((coverTargets[0]?.amount ?? null) as Centavos | null)
            }}
          >
            Cover
          </Button>
        </div>
      ) : null}

      {coverMode && activeCover ? (
        <p className="ink-2">
          Covering {coverIndex + 1} of {coverTargets.length}:{' '}
          {categories.find((c) => c.id === activeCover.categoryId)?.name ?? activeCover.categoryId}{' '}
          ({formatMoney(activeCover.amount)})
        </p>
      ) : null}

      <Field label="From">
        {(control) => (
          <select
            {...control}
            className="field-control"
            name="move-from"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          >
            <option value={RTA}>Ready to Assign</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="To">
        {(control) => (
          <select
            {...control}
            className="field-control"
            name="move-to"
            value={displayToId}
            onChange={(e) => setToId(e.target.value)}
            disabled={coverMode}
          >
            <option value="">Choose…</option>
            <option value={RTA}>Ready to Assign</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <MoneyInput
        key={activeCover ? `cover-${coverIndex}` : 'move'}
        label="Amount"
        value={displayAmount}
        onChange={setAmount}
        name="move-amount"
        required
      />
      {error ? (
        <p className="field-error" role="status">
          {error}
        </p>
      ) : null}

      <div className="plan-dialog-actions">
        <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
          {coverMode ? 'Cover' : 'Move'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </>
  )
}

export function MoveMoneyDialog({
  open,
  onClose,
  snapshot,
  month,
  categories,
  coverTargets,
  defaultToId,
  onSave,
}: {
  open: boolean
  onClose: () => void
  snapshot: BudgetSnapshot
  month: string
  categories: { id: string; name: string }[]
  coverTargets: { categoryId: string; amount: number }[]
  defaultToId?: string | null
  onSave: (input: {
    fromCategoryId: string | null
    toCategoryId: string | null
    amount: number
    kind: 'move' | 'cover'
  }) => Promise<void>
}) {
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
        <h2 id={titleId}>Move money</h2>
        <Button variant="ghost" onClick={() => dialogRef.current?.close()} aria-label="Close">
          Close
        </Button>
      </div>
      <div className="sheet-body plan-dialog-body">
        {open ? (
          <MoveMoneyBody
            key={`${defaultToId ?? 'none'}-${coverTargets.map((c) => c.categoryId).join(',')}`}
            snapshot={snapshot}
            month={month}
            categories={categories}
            coverTargets={coverTargets}
            defaultToId={defaultToId}
            onSave={onSave}
            onClose={onClose}
          />
        ) : null}
      </div>
    </dialog>
  )
}
