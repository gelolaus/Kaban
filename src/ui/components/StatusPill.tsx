import { formatMoney } from '../../domain/money.ts'
import { Amount } from './Amount.tsx'
import { VisuallyHidden } from './VisuallyHidden.tsx'
import './StatusPill.css'

export type StatusKind =
  'funded' | 'underfunded' | 'overspent' | 'credit_overspent' | 'snoozed' | 'positive' | 'zero'

export function StatusPill({
  kind,
  centavos,
  caption,
}: {
  kind: StatusKind
  centavos: number
  caption?: string
}) {
  if (kind === 'zero') {
    return (
      <span className="status-pill status-zero">
        <Amount centavos={centavos} />
      </span>
    )
  }

  if (kind === 'overspent') {
    const abs = Math.abs(centavos)
    return (
      <span className="status-pill status-overspent">
        <svg aria-hidden="true" width="10" height="8" viewBox="0 0 10 8" className="status-marker">
          <path d="M5 0L10 8H0L5 0Z" fill="currentColor" />
        </svg>
        <Amount centavos={centavos} />
        <VisuallyHidden>Overspent by {formatMoney(abs)}</VisuallyHidden>
      </span>
    )
  }

  if (kind === 'credit_overspent') {
    return (
      <span className="status-pill status-underfunded" title="Credit overspending">
        <Amount centavos={centavos} />
        <VisuallyHidden>Credit overspending {formatMoney(Math.abs(centavos))}</VisuallyHidden>
      </span>
    )
  }

  if (kind === 'underfunded') {
    return (
      <span className="status-pill status-underfunded">
        <Amount centavos={centavos} />
        {caption ? <VisuallyHidden>{caption}</VisuallyHidden> : null}
      </span>
    )
  }

  if (kind === 'snoozed') {
    return (
      <span className="status-pill status-funded">
        <Amount centavos={centavos} />
        <VisuallyHidden>Snoozed</VisuallyHidden>
      </span>
    )
  }

  return (
    <span className="status-pill status-funded">
      <Amount centavos={centavos} />
    </span>
  )
}
