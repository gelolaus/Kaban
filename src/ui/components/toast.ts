export interface ToastAction {
  label: string
  onAction: () => void
}

export interface ToastOptions {
  kind?: 'info' | 'success' | 'error'
  action?: ToastAction
  persistent?: boolean
  durationMs?: number
}

export interface ToastItem {
  id: string
  message: string
  kind: 'info' | 'success' | 'error'
  action?: ToastAction
  persistent: boolean
}

type Listener = (items: readonly ToastItem[]) => void

let nextId = 1
const items: ToastItem[] = []
const listeners = new Set<Listener>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function emit() {
  const snapshot = items.slice()
  for (const l of listeners) l(snapshot)
}

export function showToast(message: string, options: ToastOptions = {}): string {
  const kind = options.kind ?? 'info'
  const persistent = options.persistent ?? (kind === 'error' || options.action !== undefined)
  const id = String(nextId++)
  const item: ToastItem = {
    id,
    message,
    kind,
    action: options.action,
    persistent,
  }
  items.push(item)
  emit()
  if (!persistent) {
    const ms = options.durationMs ?? 3000
    timers.set(
      id,
      setTimeout(() => {
        dismissToast(id)
      }, ms),
    )
  }
  return id
}

export function dismissToast(id: string): void {
  const idx = items.findIndex((t) => t.id === id)
  if (idx === -1) return
  items.splice(idx, 1)
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  emit()
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  listener(items.slice())
  return () => {
    listeners.delete(listener)
  }
}
