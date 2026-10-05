import { useMemo, useState } from 'react'
import { useBudget } from '../../state/BudgetContext.tsx'
import { Amount } from '../../ui/components/Amount.tsx'
import { Button } from '../../ui/components/Button.tsx'
import { Card } from '../../ui/components/Card.tsx'
import { Sheet } from '../../ui/components/Sheet.tsx'
import { TransactionForm } from '../transactions/TransactionForm.tsx'

export function SpendingScreen() {
  const { data, refresh } = useBudget()
  const [editingId, setEditingId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    if (!data) return []
    const map = new Map<string, typeof data.transactions>()
    for (const t of data.transactions) {
      if (t.transfer_transaction_id && t.amount_centavos > 0) continue
      const list = map.get(t.date) ?? []
      list.push(t)
      map.set(t.date, list)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [data])

  if (!data) {
    return (
      <>
        <h1 tabIndex={-1}>Spending</h1>
        <p>Loading transactions.</p>
      </>
    )
  }

  const editing = data.transactions.find((t) => t.id === editingId)

  return (
    <>
      <h1 tabIndex={-1}>Spending</h1>
      {grouped.map(([date, txs]) => (
        <section key={date}>
          <h2 className="ink-2">{date}</h2>
          <Card>
            <ul className="tx-list">
              {txs.map((t) => {
                const payee = data.payees.find((p) => p.id === t.payee_id)
                const cat = data.categories.find((c) => c.id === t.category_id)
                const account = data.accounts.find((a) => a.id === t.account_id)
                return (
                  <li key={t.id}>
                    <button type="button" className="tx-row" onClick={() => setEditingId(t.id)}>
                      <span className="tx-l1">
                        <span>{payee?.name ?? 'Payee'}</span>
                        <Amount centavos={t.amount_centavos} />
                      </span>
                      <span className="tx-l2 ink-2">
                        <span>
                          {cat?.name ??
                            (t.amount_centavos > 0 ? 'Ready to Assign' : 'Uncategorized')}
                        </span>
                        <span>
                          {account?.name} · {t.cleared}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      ))}

      <Sheet open={!!editing} onClose={() => setEditingId(null)} title="Edit transaction">
        {editing ? (
          <TransactionForm
            initial={editing}
            onSaved={async () => {
              setEditingId(null)
              await refresh()
            }}
            onDeleted={async () => {
              setEditingId(null)
              await refresh()
            }}
          />
        ) : null}
        {editing ? (
          <Button
            onClick={async () => {
              /* delete handled in form */
            }}
            className="visually-hidden"
          >
            Placeholder
          </Button>
        ) : null}
      </Sheet>

      <style>{`
        .tx-list { list-style:none; margin:0; padding:0; }
        .tx-row { width:100%; border:0; background:transparent; text-align:start; padding:.75rem 1rem; cursor:pointer; color:inherit; }
        .tx-l1, .tx-l2 { display:flex; justify-content:space-between; gap:.5rem; }
        .tx-l2 { margin-top:.35rem; font-size: var(--fs-caption); }
      `}</style>
    </>
  )
}
