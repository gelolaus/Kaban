import './ProgressBar.css'

export function ProgressBar({
  value,
  max,
  tone = 'normal',
  label,
}: {
  value: number
  max: number
  tone?: 'normal' | 'danger'
  label: string
}) {
  const safeMax = max <= 0 ? 1 : max
  const clamped = Math.min(Math.max(value, 0), safeMax)
  return (
    <progress
      className={`progress-bar ${tone === 'danger' ? 'progress-danger' : ''}`}
      value={clamped}
      max={safeMax}
      aria-label={label}
    />
  )
}
