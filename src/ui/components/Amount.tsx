import { formatMoney } from '../../domain/money.ts'

export function Amount({ centavos, className = '' }: { centavos: number; className?: string }) {
  return <span className={className}>{formatMoney(centavos)}</span>
}
