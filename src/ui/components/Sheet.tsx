import { useEffect, useId, useRef } from 'react'
import { Button } from './Button.tsx'
import './Sheet.css'

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <div className="sheet-header">
        <h2 id={titleId}>{title}</h2>
        <Button variant="ghost" onClick={() => dialogRef.current?.close()} aria-label="Close">
          Close
        </Button>
      </div>
      <div className="sheet-body">{children}</div>
    </dialog>
  )
}
