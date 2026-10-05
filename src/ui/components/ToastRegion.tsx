import { useEffect, useState } from 'react'
import { Button } from './Button.tsx'
import { dismissToast, subscribeToasts, type ToastItem } from './toast.ts'
import './Toast.css'

export function ToastRegion() {
  const [items, setItems] = useState<readonly ToastItem[]>([])
  useEffect(() => subscribeToasts(setItems), [])

  const announcement = items.map((t) => t.message).join('. ')

  return (
    <>
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
      <div className="toast-stack">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </div>
    </>
  )
}

function ToastCard({ item }: { item: ToastItem }) {
  return (
    <div id={`toast-${item.id}`} className="toast" data-kind={item.kind}>
      <span>{item.message}</span>
      {item.action ? (
        <Button
          variant="ghost"
          onClick={() => {
            item.action?.onAction()
            dismissToast(item.id)
          }}
        >
          {item.action.label}
        </Button>
      ) : null}
      <Button variant="ghost" onClick={() => dismissToast(item.id)}>
        Dismiss
      </Button>
    </div>
  )
}
