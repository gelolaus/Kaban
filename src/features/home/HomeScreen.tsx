import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { formatMoney } from '../../domain/money.ts'
import { computeTargets } from '../../engine/targets.ts'
import type { EngineTarget } from '../../engine/types.ts'
import { currentMonthKey, useBudget } from '../../state/BudgetContext.tsx'
import { toEngineSnapshot } from '../../state/budgetMath.ts'
import { Amount } from '../../ui/components/Amount.tsx'
import { Button } from '../../ui/components/Button.tsx'
import { Card } from '../../ui/components/Card.tsx'
import { TargetEditor } from '../plan/TargetEditor.tsx'
import { settingValue } from '../plan/targetCopy.ts'
import '../screens.css'

export function HomeScreen() {
  const { data, view, repo, refresh, month } = useBudget()
  const todayMonth = currentMonthKey()
  const [adjustOpen, setAdjustOpen] = useState(false)

  const pinned = data?.pins ?? []
  const cats = data?.categories ?? []

  const pinnedCats = pinned
    .map((p) => cats.find((c) => c.id === p.category_id))
    .filter((c): c is NonNullable<typeof c> => !!c && !c.hidden)

  const snapshot = useMemo(() => (data ? toEngineSnapshot(data) : null), [data])
  const goalId = data ? settingValue(data.settings, 'current_goal_category_id') : null
  const goalCat = goalId ? cats.find((c) => c.id === goalId && !c.hidden) : null

  const goalTarget: EngineTarget | null = useMemo(() => {
    if (!snapshot || !goalId) return null
    return snapshot.targets?.find((t) => t.categoryId === goalId) ?? null
  }, [snapshot, goalId])

  const goalView = useMemo(() => {
    if (!snapshot || !goalId) return null
    return computeTargets(snapshot, month, todayMonth)[goalId] ?? null
  }, [snapshot, goalId, month, todayMonth])

  const progressPct = goalView ? Math.round(goalView.progress * 100) : 0
  const available = goalId && view ? (view.categories[goalId]?.available ?? 0) : 0
  const funded =
    goalTarget && goalView
      ? goalTarget.behavior === 'balance'
        ? Math.min(goalTarget.amount, Math.max(0, available))
        : Math.max(0, goalView.askThisMonth - goalView.needed)
      : 0
  const toGo =
    goalTarget && goalView
      ? goalTarget.behavior === 'balance'
        ? Math.max(0, goalTarget.amount - Math.max(0, available))
        : goalView.needed
      : 0

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
        {!goalCat || !goalTarget || !goalView ? (
          <p className="empty-state">
            Set a current goal from a category&apos;s Plan inspector (Edit target, then Set as
            current goal).
          </p>
        ) : (
          <div className="goal-card">
            <div className="goal-ring-wrap">
              <progress
                className="goal-ring"
                value={progressPct}
                max={100}
                style={{ ['--value' as string]: progressPct }}
                aria-label={`${goalCat.name} ${progressPct}% complete`}
              />
              <div className="goal-ring-label">
                <span className="goal-ring-pct">{progressPct}%</span>
                <span className="ink-2">Complete</span>
              </div>
            </div>
            <p className="goal-name">{goalCat.name}</p>
            <dl className="goal-stats">
              <div>
                <dt>Funded</dt>
                <dd>
                  <Amount centavos={funded} />
                </dd>
              </div>
              <div>
                <dt>To go</dt>
                <dd>
                  <Amount centavos={toGo} />
                </dd>
              </div>
            </dl>
            <p className="visually-hidden">
              Target {formatMoney(goalTarget.amount)}. Progress {progressPct} percent.
            </p>
            <Button onClick={() => setAdjustOpen(true)}>Adjust</Button>
          </div>
        )}
      </Card>

      {goalCat && adjustOpen ? (
        <TargetEditor
          open={adjustOpen}
          categoryId={goalCat.id}
          categoryName={goalCat.name}
          existing={goalTarget}
          onClose={() => setAdjustOpen(false)}
          onSave={async (input) => {
            if (!repo) return
            await repo.upsertTarget(input)
            await refresh()
          }}
          onDelete={
            goalTarget
              ? async () => {
                  if (!repo) return
                  await repo.deleteTarget(goalCat.id)
                  await refresh()
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
