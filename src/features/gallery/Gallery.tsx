import { useState } from 'react'
import { Amount } from '../../ui/components/Amount.tsx'
import { Button } from '../../ui/components/Button.tsx'
import { Card } from '../../ui/components/Card.tsx'
import { Chip } from '../../ui/components/Chip.tsx'
import { Field } from '../../ui/components/Field.tsx'
import { MoneyInput } from '../../ui/components/MoneyInput.tsx'
import { ProgressBar } from '../../ui/components/ProgressBar.tsx'
import { Sheet } from '../../ui/components/Sheet.tsx'
import { showToast } from '../../ui/components/toast.ts'
import { ToastRegion } from '../../ui/components/ToastRegion.tsx'
import { StatusPill } from '../../ui/components/StatusPill.tsx'
import type { Centavos } from '../../domain/money.ts'

export function Gallery() {
  const [pressed, setPressed] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [amount, setAmount] = useState<Centavos | null>(null)
  const [payee, setPayee] = useState('')

  return (
    <main id="content" tabIndex={-1}>
      <h1>Component gallery</h1>
      <Card>
        <Button variant="primary">Assign</Button>
        <Button>Secondary</Button>
        <Chip selected={pressed} onClick={() => setPressed((v) => !v)}>
          Filter
        </Chip>
        <Amount centavos={120050} />
        <p className="ink-2">Secondary sample text</p>
        <StatusPill kind="funded" centavos={300000} />
        <StatusPill kind="underfunded" centavos={40000} />
        <StatusPill kind="overspent" centavos={-50000} />
        <StatusPill kind="zero" centavos={0} />
        <ProgressBar value={150} max={100} label="Groceries funded" />
        <Button onClick={() => setSheetOpen(true)}>Open sheet</Button>
        <Button
          onClick={() => {
            showToast('One')
            showToast('Two')
            showToast('Three')
          }}
        >
          Show 3 toasts
        </Button>
        <Button
          onClick={() =>
            showToast('Update ready', {
              action: { label: 'Reload', onAction: () => {} },
            })
          }
        >
          Show update toast
        </Button>
        <MoneyInput label="Amount" value={amount} onChange={setAmount} required />
        <Field label="Payee">
          {(control) => (
            <input
              {...control}
              className="field-control"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
            />
          )}
        </Field>
      </Card>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="New transaction">
        <p>Sheet body for gallery tests.</p>
      </Sheet>
      <ToastRegion />
    </main>
  )
}
