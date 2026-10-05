import type { HTMLAttributes } from 'react'
import './Card.css'

export function Card({
  as: Tag = 'section',
  className = '',
  ...props
}: HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' | 'li' }) {
  return <Tag className={`card ${className}`.trim()} {...props} />
}
