import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Plus } from 'lucide-react'
import { NAV_ITEMS } from './nav.ts'
import { useRouteAnnouncer } from './useRouteAnnouncer.ts'
import { Sheet } from '../ui/components/Sheet.tsx'
import { ToastRegion } from '../ui/components/ToastRegion.tsx'
import './shell.css'

export function Shell() {
  useRouteAnnouncer()
  const location = useLocation()
  const [txOpen, setTxOpen] = useState(false)
  const showFab = location.pathname !== '/reflect'

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
          <NavLink
            key={item.path}
            to={item.path}
            className="shell-nav"
            aria-label={item.label}
          >
            <item.icon size={18} strokeWidth={1.5} aria-hidden />
            <span className="shell-nav-label">{item.label}</span>
          </NavLink>
        ))}      </nav>

      <main id="content" className="shell-main" tabIndex={-1}>
        <Outlet />
      </main>

      <aside className="shell-inspector" aria-label="Inspector">
        <p className="ink-2">Select a category to inspect.</p>
      </aside>

      <nav className="shell-tabs" aria-label="Tabs">
        {NAV_ITEMS.filter((n) => n.phone).map((item) => (
          <NavLink key={item.path} to={item.path} className="shell-tab">
            <item.icon size={21} strokeWidth={1.5} aria-hidden />
            <span>{item.phoneLabel ?? item.label}</span>
          </NavLink>
        ))}
      </nav>

      {showFab ? (
        <button type="button" className="shell-fab" onClick={() => setTxOpen(true)}>
          <Plus size={20} strokeWidth={1.5} aria-hidden />
          Transaction
        </button>
      ) : null}

      <Sheet open={txOpen} onClose={() => setTxOpen(false)} title="New transaction">
        <p>Adding transactions arrives in plan 2.</p>
      </Sheet>
      <ToastRegion />
    </div>
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
