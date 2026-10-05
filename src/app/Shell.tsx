import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Plus } from 'lucide-react'
import { NAV_ITEMS } from './nav.ts'
import { useRouteAnnouncer } from './useRouteAnnouncer.ts'
import { Sheet } from '../ui/components/Sheet.tsx'
import { ToastRegion } from '../ui/components/ToastRegion.tsx'
import { TransactionForm } from '../features/transactions/TransactionForm.tsx'
import { useBudget } from '../state/BudgetContext.tsx'
import { InspectorProvider, useInspectorSlot } from './InspectorContext.tsx'
import './shell.css'

function ShellChrome({
  txOpen,
  setTxOpen,
  showTx,
}: {
  txOpen: boolean
  setTxOpen: (open: boolean) => void
  showTx: boolean
}) {
  const { refresh } = useBudget()
  const inspector = useInspectorSlot()

  useEffect(() => {
    if (!showTx) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setTxOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTxOpen, showTx])

  return (
    <div className="shell">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <nav className="shell-side" aria-label="Main">
        <div className="shell-plan-name">
          <div>Kaban</div>
          <div className="ink-2">Personal plan</div>
        </div>
        {NAV_ITEMS.filter((n) => n.laptop).map((item) => (
          <NavLink key={item.path} to={item.path} className="shell-nav" aria-label={item.label}>
            <item.icon size={18} strokeWidth={1.5} aria-hidden />
            <span className="shell-nav-label">{item.label}</span>
          </NavLink>
        ))}
        {showTx ? (
          <button type="button" className="shell-tx-desk" onClick={() => setTxOpen(true)}>
            <Plus size={18} strokeWidth={1.5} aria-hidden />
            <span className="shell-nav-label">Transaction</span>
          </button>
        ) : null}
      </nav>

      <main id="content" className="shell-main" tabIndex={-1}>
        <Outlet />
      </main>

      <aside className="shell-inspector" aria-label="Inspector" data-inspector-root="">
        {inspector ?? <p className="ink-2">Select a category to inspect.</p>}
      </aside>

      <nav className="shell-tabs" aria-label="Tabs">
        {NAV_ITEMS.filter((n) => n.phone).map((item) => (
          <NavLink key={item.path} to={item.path} className="shell-tab">
            <item.icon size={21} strokeWidth={1.5} aria-hidden />
            <span>{item.phoneLabel ?? item.label}</span>
          </NavLink>
        ))}
      </nav>

      {showTx ? (
        <button type="button" className="shell-fab" onClick={() => setTxOpen(true)}>
          <Plus size={20} strokeWidth={1.5} aria-hidden />
          Transaction
        </button>
      ) : null}

      <Sheet open={txOpen} onClose={() => setTxOpen(false)} title="New transaction">
        {txOpen ? (
          <TransactionForm
            key="new-tx"
            onSaved={async () => {
              setTxOpen(false)
              await refresh()
            }}
          />
        ) : null}
      </Sheet>
      <ToastRegion />
    </div>
  )
}

export function Shell() {
  useRouteAnnouncer()
  const location = useLocation()
  const { status, errorMessage } = useBudget()
  const [txOpen, setTxOpen] = useState(false)
  const showTx = location.pathname !== '/reflect'

  if (status === 'tab-blocked') {
    return (
      <main id="content" className="shell-main" tabIndex={-1}>
        <h1>Kaban is already open in another tab</h1>
        <p>Close the other tab, then reload this page.</p>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main id="content" className="shell-main" tabIndex={-1}>
        <h1>Could not open the budget</h1>
        <p>{errorMessage}</p>
      </main>
    )
  }

  if (status === 'loading') {
    return (
      <main id="content" className="shell-main" tabIndex={-1}>
        <h1>Kaban</h1>
        <p>Opening local budget.</p>
      </main>
    )
  }

  return (
    <InspectorProvider>
      <ShellChrome txOpen={txOpen} setTxOpen={setTxOpen} showTx={showTx} />
    </InspectorProvider>
  )
}

export function NotFoundScreen() {
  useEffect(() => {
    document.title = 'Not found | Kaban'
    const heading = document.querySelector('h1')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus()
  }, [])

  return (
    <main id="content" tabIndex={-1}>
      <h1 tabIndex={-1}>Not found</h1>
      <p>
        <Link to="/">Go home</Link>
      </p>
    </main>
  )
}
