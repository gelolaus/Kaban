import { Calendar, Check, CreditCard, Moon, PieChart } from 'lucide-react'
import type { TargetStatus } from '../../engine/types.ts'

export function TargetStatusIcon({ status }: { status: TargetStatus }) {
  const size = 16
  const stroke = 1.5
  switch (status) {
    case 'overspent':
      return (
        <span className="plan-target-icon" title="Overspent">
          <PieChart size={size} strokeWidth={stroke} aria-hidden />
          <span className="visually-hidden">Overspent</span>
        </span>
      )
    case 'credit_overspent':
      return (
        <span className="plan-target-icon" title="Credit overspending">
          <CreditCard size={size} strokeWidth={stroke} aria-hidden />
          <span className="visually-hidden">Credit overspending</span>
        </span>
      )
    case 'underfunded':
      return (
        <span className="plan-target-icon" title="Underfunded">
          <PieChart size={size} strokeWidth={stroke} aria-hidden />
          <span className="visually-hidden">Underfunded</span>
        </span>
      )
    case 'funded':
      return (
        <span className="plan-target-icon" title="Funded">
          <Check size={size} strokeWidth={stroke} aria-hidden />
          <span className="visually-hidden">Funded</span>
        </span>
      )
    case 'snoozed':
      return (
        <span className="plan-target-icon" title="Snoozed">
          <Moon size={size} strokeWidth={stroke} aria-hidden />
          <span className="visually-hidden">Snoozed</span>
        </span>
      )
    case 'positive':
      return (
        <span className="plan-target-icon" title="Available">
          <Check size={size} strokeWidth={stroke} aria-hidden />
          <span className="visually-hidden">Positive available</span>
        </span>
      )
    case 'zero':
    default:
      return (
        <span className="plan-target-icon" title="At zero">
          <Calendar size={size} strokeWidth={stroke} aria-hidden />
          <span className="visually-hidden">At zero</span>
        </span>
      )
  }
}
