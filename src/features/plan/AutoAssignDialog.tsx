import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatMoney, parseMoney } from '../../domain/money.ts'
import { autoAssignPreview, type AutoAssignScope } from '../../engine/autoAssign.ts'
import type { AutoAssignOption, BudgetSnapshot } from '../../engine/types.ts'
import { Button } from '../../ui/components/Button.tsx'
import { Field } from '../../ui/components/Field.tsx'
import './plan.css'

const OPTION_LABELS: Record<AutoAssignOption, string> = {
  underfunded: 'Underfunded',
  assigned_last_month: 'Assigned last month',
  spent_last_month: 'Spent last month',
  average_assigned: 'Average assigned',
  average_spent: 'Average spent',
  reduce_overfunding: 'Reduce overfunding',
  reset_available: 'Reset available amounts',
  reset_assigned: 'Reset assigned amounts',
}

function pesosText(centavos: number): string {
  const sign = centavos < 0 ? '−' : ''
  return `${sign}${(Math.abs(centavos) / 100).toFixed(2)}`
}

function AutoAssignBody({
  snapshot,
  month,
  currentMonth,
  scope,
  categoryNames,
  onSave,
  onClose,
}: {
  snapshot: BudgetSnapshot
  month: string
  currentMonth: string
  scope: AutoAssignScope
  categoryNames: Record<string, string>
  onSave: (deltas: { categoryId: string; delta: number }[]) => Promise<void>
  onClose: () => void
}) {
  const applicable = useMemo(() => {
    const options: AutoAssignOption[] = [
      'underfunded',
      'assigned_last_month',
      'spent_last_month',
      'average_assigned',
      'average_spent',
      'reduce_overfunding',
      'reset_available',
      'reset_assigned',
    ]
    return options.filter((o) => {
      const preview = autoAssignPreview(snapshot, month, currentMonth, o, scope)
      return preview.deltas.length > 0
    })
  }, [snapshot, month, currentMonth, scope])

  const [option, setOption] = useState<AutoAssignOption | null>(applicable[0] ?? null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const activeOption = option && applicable.includes(option) ? option : (applicable[0] ?? null)

  const preview = useMemo(() => {
    if (!activeOption) return null
    return autoAssignPreview(snapshot, month, currentMonth, activeOption, scope)
  }, [activeOption, snapshot, month, currentMonth, scope])

  const rows = useMemo(() => {
    if (!preview) return []
    return preview.deltas.map((d) => {
      const edited = edits[d.categoryId]
      let delta = d.delta
      if (edited !== undefined) {
        const negative = edited.trim().startsWith('-') || edited.trim().startsWith('−')
        const parsed = parseMoney(edited.replace(/^[-−]/, ''))
        if (parsed.ok) delta = negative ? -parsed.value : parsed.value
      }
      return { categoryId: d.categoryId, delta, original: d.delta }
    })
  }, [preview, edits])

  const rtaAfter = useMemo(() => {
    if (!preview) return 0
    const originalSum = preview.deltas.reduce((s, d) => s + d.delta, 0)
    const editedSum = rows.reduce((s, r) => s + r.delta, 0)
    return preview.readyToAssignAfter + (originalSum - editedSum)
  }, [preview, rows])

  async function handleSave() {
    if (!activeOption || rows.length === 0) return
    if (activeOption === 'reset_assigned') {
      const ok = window.confirm(
        'Reset assigned amounts to zero for the visible categories? This cannot be undone except with Undo.',
      )
      if (!ok) return
    }
    setSaving(true)
    try {
      await onSave(rows.map((r) => ({ categoryId: r.categoryId, delta: r.delta })))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (applicable.length === 0) {
    return <p className="empty-state">No Auto-Assign options apply right now.</p>
  }

  return (
    <>
      <Field label="Option">
        {(control) => (
          <select
            {...control}
            className="field-control"
            name="auto-assign-option"
            value={activeOption ?? ''}
            onChange={(e) => {
              setOption(e.target.value as AutoAssignOption)
              setEdits({})
            }}
          >
            {applicable.map((o) => (
              <option key={o} value={o}>
                {OPTION_LABELS[o]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <table className="plan-preview-table">
        <caption className="visually-hidden">Assignment preview</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.categoryId}>
              <th scope="row">{categoryNames[r.categoryId] ?? r.categoryId}</th>
              <td>
                <input
                  className="field-control plan-preview-amount"
                  name={`preview-${r.categoryId}`}
                  inputMode="decimal"
                  aria-label={`Amount for ${categoryNames[r.categoryId] ?? r.categoryId}`}
                  value={edits[r.categoryId] ?? pesosText(r.original)}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [r.categoryId]: e.target.value }))
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        Ready to Assign after: <span className="font-money">{formatMoney(rtaAfter)}</span>
      </p>

      <div className="plan-dialog-actions">
        <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
          Save assignments
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </>
  )
}

export function AutoAssignDialog({
  open,
  onClose,
  snapshot,
  month,
  currentMonth,
  scope,
  categoryNames,
  onSave,
}: {
  open: boolean
  onClose: () => void
  snapshot: BudgetSnapshot
  month: string
  currentMonth: string
  scope: AutoAssignScope
  categoryNames: Record<string, string>
  onSave: (deltas: { categoryId: string; delta: number }[]) => Promise<void>
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
      className="sheet plan-dialog plan-dialog-wide"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <div className="sheet-header">
        <h2 id={titleId}>Auto-Assign</h2>
        <Button variant="ghost" onClick={() => dialogRef.current?.close()} aria-label="Close">
          Close
        </Button>
      </div>
      <div className="sheet-body plan-dialog-body">
        {open ? (
          <AutoAssignBody
            key={`${month}-${scope.categoryIds?.join(',') ?? 'all'}`}
            snapshot={snapshot}
            month={month}
            currentMonth={currentMonth}
            scope={scope}
            categoryNames={categoryNames}
            onSave={onSave}
            onClose={onClose}
          />
        ) : null}
      </div>
    </dialog>
  )
}
