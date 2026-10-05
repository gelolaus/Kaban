import { useState } from 'react'
import { useBudget } from '../../state/BudgetContext.tsx'
import { Amount } from '../../ui/components/Amount.tsx'
import { Button } from '../../ui/components/Button.tsx'
import { Card } from '../../ui/components/Card.tsx'
import { Field } from '../../ui/components/Field.tsx'
import { MoneyInput } from '../../ui/components/MoneyInput.tsx'
import { Sheet } from '../../ui/components/Sheet.tsx'
import type { AccountType } from '../../storage/types.ts'
import type { Centavos } from '../../domain/money.ts'
import '../screens.css'

export function AccountsScreen() {
  const { data, balances, repo, refresh } = useBudget()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [balance, setBalance] = useState<Centavos | null>(null)

  if (!data) {
    return (
      <>
        <h1 tabIndex={-1}>Accounts</h1>
        <p>Loading accounts.</p>
      </>
    )
  }

  const cash = data.accounts.filter((a) => a.type !== 'creditCard' && a.type !== 'lineOfCredit')
  const credit = data.accounts.filter((a) => a.type === 'creditCard' || a.type === 'lineOfCredit')

  async function save() {
    if (!repo || !name.trim() || balance === null) return
    await repo.createAccount({
      name: name.trim(),
      type,
      startingBalanceCentavos: balance,
    })
    setOpen(false)
    setName('')
    setBalance(null)
    await refresh()
  }

  return (
    <div className="screen-stack">
      <div className="screen-header">
        <h1 tabIndex={-1}>Accounts</h1>
        <Button onClick={() => setOpen(true)}>Add account</Button>
      </div>

      <Card>
        <h2>Cash</h2>
        {cash.length === 0 ? (
          <p className="empty-state">No cash accounts yet.</p>
        ) : (
          <ul className="row-list account-list">
            {cash.map((a) => (
              <li key={a.id}>
                <span>{a.name}</span>
                <Amount centavos={balances[a.id] ?? 0} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2>Credit</h2>
        {credit.length === 0 ? (
          <p className="empty-state">No credit accounts yet.</p>
        ) : (
          <ul className="row-list account-list">
            {credit.map((a) => (
              <li key={a.id}>
                <span>{a.name}</span>
                <Amount centavos={balances[a.id] ?? 0} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} title="Add account">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Field label="Name">
            {(control) => (
              <input
                {...control}
                className="field-control"
                name="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
          </Field>
          <fieldset>
            <legend>Type</legend>
            {(
              [
                ['checking', 'Checking'],
                ['savings', 'Savings'],
                ['cash', 'Cash'],
                ['creditCard', 'Credit card'],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="account-type"
                  checked={type === value}
                  onChange={() => setType(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <MoneyInput
            label="Starting balance"
            value={balance}
            onChange={setBalance}
            required
            name="starting-balance"
          />
          <Button type="submit" variant="primary">
            Save account
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
