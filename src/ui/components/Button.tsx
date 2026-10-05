import type { ButtonHTMLAttributes } from 'react'
import './Button.css'

export function Button({
  variant = 'secondary',
  type = 'button',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  return <button type={type} className={`btn btn-${variant} ${className}`.trim()} {...props} />
}
