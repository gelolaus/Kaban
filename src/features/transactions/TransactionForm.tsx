import { useState } from 'react'
import { useBudget } from '../../state/BudgetContext.tsx'
import { Button } from '../../ui/components/Button.tsx'
import { Field } from '../../ui/components/Field.tsx'
import { MoneyInput } from '../../ui/components/MoneyInput.tsx'
import type { Centavos } from '../../domain/money.ts'
import type { TransactionRow } from '../../storage/types.ts'
import { temporal, isoDate } from '../../domain/dates.ts'

export function TransactionForm({
  initial,
  onSaved,
  onDeleted,
  defaultKind = 'outflow',
}: {
  initial?: TransactionRow
  onSaved: () => Promise<void>
  onDeleted?: () => Promise<void>
  defaultKind?: 'outflow' | 'inflow' | 'transfer'
}) {
  const { data, repo } = useBudget()
  const [kind, setKind] = useState<'outflow' | 'inflow' | 'transfer'>(defaultKind)
  const [amount, setAmount] = useState<Centavos | null>(
    initial ? (Math.abs(initial.amount_centavos) as Centavos) : null,
  )
  const [payee, setPayee] = useState('')
  const [accountId, setAccountId] = useState(initial?.account_id ?? data?.accounts[0]?.id ?? '')
  const [transferTo, setTransferTo] = useState('')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [date, setDate] = useState(initial?.date ?? isoDate(temporal().Now.plainDateISO()))
  const [cleared, setCleared] = useState<TransactionRow['cleared']>(initial?.cleared ?? 'uncleared')

  if (!data || !repo) return null

  async function save() {
    if (!repo || amount === null || !accountId) return
    const signed = kind === 'inflow' ? amount : kind === 'outflow' ? -amount : -amount

    if (initial) {
      await repo.updateTransaction(initial.id, {
        date,
        amountCentavos: signed,
        memo: memo || null,
        cleared,
        categoryId: kind === 'inflow' ? null : categoryId || null,
        accountId,
      })
    } else {
      await repo.insertTransaction({
        accountId,
        date,
        amountCentavos: signed,
        memo: memo || null,
        cleared,
        categoryId: kind === 'inflow' ? null : categoryId || null,
        payeeName: payee || (kind === 'transfer' ? 'Transfer' : 'Payee'),
        inflowToRta: kind === 'inflow',
        transferAccountId: kind === 'transfer' ? transferTo : undefined,
      })
    }
    await onSaved()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="kind-switch">
        {(['outflow', 'inflow', 'transfer'] as const).map((k) => (
          <Button
            key={k}
            type="button"
            variant={kind === k ? 'primary' : 'secondary'}
            onClick={() => setKind(k)}
          >
            {k === 'outflow' ? 'Outflow' : k === 'inflow' ? 'Inflow' : 'Transfer'}
          </Button>
        ))}
      </div>
      <MoneyInput label="Amount" value={amount} onChange={setAmount} required name="tx-amount" />
      <Field label="Payee">
        {(control) => (
          <input
            {...control}
            className="field-control"
            name="payee"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            list="payee-list"
          />
        )}
      </Field>
      <datalist id="payee-list">
        {data.payees.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      {kind !== 'transfer' && kind !== 'inflow' ? (
        <Field label="Category">
          {(control) => (
            <select
              {...control}
              className="field-control"
              name="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Select category</option>
              {data.categories
                .filter((c) => !c.hidden && c.kind === 'normal')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}
        </Field>
      ) : null}
      <Field label="Account">
        {(control) => (
          <select
            {...control}
            className="field-control"
            name="account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {kind === 'transfer' ? (
        <Field label="To account">
          {(control) => (
            <select
              {...control}
              className="field-control"
              name="transfer-to"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              required
            >
              <option value="">Select account</option>
              {data.accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          )}
        </Field>
      ) : null}
      <Field label="Date">
        {(control) => (
          <input
            {...control}
            className="field-control"
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        )}
      </Field>
      <Field label="Memo">
        {(control) => (
          <input
            {...control}
            className="field-control"
            name="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        )}
      </Field>
      <fieldset>
        <legend>Cleared</legend>
        {(['uncleared', 'cleared', 'reconciled'] as const).map((c) => (
          <label key={c}>
            <input
              type="radio"
              name="cleared"
              checked={cleared === c}
              onChange={() => setCleared(c)}
            />
            {c}
          </label>
        ))}
      </fieldset>
      <Button type="submit" variant="primary">
        Save transaction
      </Button>
      {initial && onDeleted ? (
        <Button
          type="button"
          onClick={async () => {
            await repo.deleteTransaction(initial.id)
            await onDeleted()
          }}
        >
          Delete transaction
        </Button>
      ) : null}
      <style>{`.kind-switch{display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap}`}</style>
    </form>
  )
}
