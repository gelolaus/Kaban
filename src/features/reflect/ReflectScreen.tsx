import { Card } from '../../ui/components/Card.tsx'
import '../screens.css'

export function ReflectScreen() {
  return (
    <div className="screen-stack">
      <h1 tabIndex={-1}>Reflect</h1>
      <Card>
        <h2>Spending breakdown</h2>
        <p className="empty-state">Reflect charts arrive in Plan 6.</p>
      </Card>
      <Card>
        <h2>Income vs. spending</h2>
        <p className="empty-state">Charts arrive in Plan 6.</p>
      </Card>
      <Card>
        <h2>Net worth</h2>
        <p className="empty-state">Charts arrive in Plan 6.</p>
      </Card>
    </div>
  )
}
