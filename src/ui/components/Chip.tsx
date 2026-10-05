import type { ButtonHTMLAttributes } from 'react'
import './Chip.css'

export function Chip({
  selected = false,
  type = 'button',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type={type}
      className={`chip ${selected ? 'chip-on' : ''} ${className}`.trim()}
      aria-pressed={selected}
      {...props}
    />
  )
}
