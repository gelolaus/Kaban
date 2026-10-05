import { Link } from 'react-router'
import { useBudget } from '../../state/BudgetContext.tsx'
import { Amount } from '../../ui/components/Amount.tsx'
import { Card } from '../../ui/components/Card.tsx'

export function HomeScreen() {
  const { data, view } = useBudget()
  const pinned = data?.pins ?? []
  const cats = data?.categories ?? []

  return (
    <>
      <div className="home-header">
        <h1 tabIndex={-1}>Home</h1>
        <Link className="home-settings" to="/settings">
          Settings
        </Link>
      </div>
      <Card>
        <h2>Pinned</h2>
        {pinned.length === 0 ? (
          <p className="ink-2">Pin categories in a later plan. Showing first categories for now.</p>
        ) : null}
        <ul className="pin-list">
          {(pinned.length
            ? pinned.map((p) => cats.find((c) => c.id === p.category_id)).filter(Boolean)
            : cats.filter((c) => c.kind === 'normal' && !c.hidden).slice(0, 3)
          ).map((c) =>
            c ? (
              <li key={c.id}>
                <span>{c.name}</span>
                <Amount centavos={view?.categories[c.id]?.available ?? 0} />
              </li>
            ) : null,
          )}
        </ul>
      </Card>
      <Card>
        <h2>Current goal</h2>
        <p className="ink-2">Targets arrive in Plan 3.</p>
      </Card>
      <style>{`
        .home-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
        .home-settings{color:inherit;text-decoration:none;padding:.5rem 1rem;background:var(--control);border-radius:999px}
        .pin-list{list-style:none;margin:0;padding:0}
        .pin-list li{display:flex;justify-content:space-between;padding:.75rem 1rem}
        .card{margin-bottom:.75rem}
      `}</style>
    </>
  )
}
