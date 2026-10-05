import { Link } from 'react-router'
import { useBudget } from '../../state/BudgetContext.tsx'
import { Amount } from '../../ui/components/Amount.tsx'
import { Card } from '../../ui/components/Card.tsx'
import '../screens.css'

export function HomeScreen() {
  const { data, view } = useBudget()
  const pinned = data?.pins ?? []
  const cats = data?.categories ?? []

  const pinnedCats = pinned
    .map((p) => cats.find((c) => c.id === p.category_id))
    .filter((c): c is NonNullable<typeof c> => !!c && !c.hidden)

  return (
    <div className="screen-stack">
      <div className="screen-header">
        <h1 tabIndex={-1}>Home</h1>
        <Link className="screen-link" to="/settings">
          Settings
        </Link>
      </div>
      <Card>
        <h2>Pinned</h2>
        {pinnedCats.length === 0 ? (
          <p className="empty-state">Pin categories from the Plan inspector to see them here.</p>
        ) : (
          <ul className="row-list">
            {pinnedCats.map((c) => (
              <li key={c.id}>
                <span>{c.name}</span>
                <Amount centavos={view?.categories[c.id]?.available ?? 0} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2>Current goal</h2>
        <p className="empty-state">Targets arrive in Plan 3.</p>
      </Card>
    </div>
  )
}
