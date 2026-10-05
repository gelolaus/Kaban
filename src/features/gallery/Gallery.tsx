import { useState } from 'react'
import { Amount } from '../../ui/components/Amount.tsx'
import { Button } from '../../ui/components/Button.tsx'
import { Card } from '../../ui/components/Card.tsx'
import { Chip } from '../../ui/components/Chip.tsx'
import { ProgressBar } from '../../ui/components/ProgressBar.tsx'
import { StatusPill } from '../../ui/components/StatusPill.tsx'

export function Gallery() {
  const [pressed, setPressed] = useState(false)

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
      </Card>
    </main>
  )
}
