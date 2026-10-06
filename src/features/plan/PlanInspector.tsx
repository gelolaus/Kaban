import { useMemo, useState, type ReactNode } from 'react'
import { formatMoney, type Centavos } from '../../domain/money.ts'
import { canSnooze, costToBeMe } from '../../engine/targets.ts'
import type { CategoryTargetView, EngineTarget } from '../../engine/types.ts'
import { computeMonth } from '../../engine/compute.ts'
import { currentMonthKey, useBudget } from '../../state/BudgetContext.tsx'
import { toEngineSnapshot } from '../../state/budgetMath.ts'
import type { CategoryRow } from '../../storage/types.ts'
import { Amount } from '../../ui/components/Amount.tsx'
import { Button } from '../../ui/components/Button.tsx'
import { Card } from '../../ui/components/Card.tsx'
import { Field } from '../../ui/components/Field.tsx'
import { MoneyInput } from '../../ui/components/MoneyInput.tsx'
import { neededCaption, settingValue } from './targetCopy.ts'
import './plan.css'

function CategoryExtras({
  cat,
  pinned,
  onClose,
}: {
  cat: CategoryRow
  pinned: boolean
  onClose?: () => void
}) {
  const { data, repo, refresh } = useBudget()
  const [rename, setRename] = useState(cat.name)
  const [note, setNote] = useState(cat.note ?? '')

  if (cat.kind !== 'normal' || !data) return null

  return (
    <div className="plan-cat-actions">
      <Field label="Rename">
        {(control) => (
          <input
            {...control}
            className="field-control"
            name="rename-category"
            value={rename}
            onChange={(e) => setRename(e.target.value)}
          />
        )}
      </Field>
      <Button
        onClick={async () => {
          if (!repo) return
          const next = rename.trim()
          if (!next || next === cat.name) return
          await repo.renameCategory(cat.id, next)
          await refresh()
        }}
      >
        Rename category
      </Button>
      <Field label="Notes">
        {(control) => (
          <textarea
            {...control}
            className="field-control"
            name="category-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Field>
      <Button
        onClick={async () => {
          if (!repo) return
          const next = note.trim() || null
          if (next === (cat.note ?? null)) return
          await repo.setCategoryNote(cat.id, next)
          await refresh()
        }}
      >
        Save note
      </Button>
      <Button
        onClick={async () => {
          if (!repo) return
          await repo.hideCategory(cat.id, true)
          await refresh()
          onClose?.()
        }}
      >
        Hide category
      </Button>
      <Button
        onClick={async () => {
          if (!repo) return
          if (pinned) await repo.unpinCategory(cat.id)
          else await repo.pinCategory(cat.id)
          await refresh()
        }}
      >
        {pinned ? 'Unpin from Home' : 'Pin to Home'}
      </Button>
      <Button
        onClick={async () => {
          if (!repo) return
          const siblings = data.categories
            .filter((c) => c.group_id === cat.group_id && !c.hidden)
            .sort((a, b) => a.sort_order - b.sort_order)
          const idx = siblings.findIndex((c) => c.id === cat.id)
          if (idx <= 0) return
          const ids = siblings.map((c) => c.id)
          ;[ids[idx - 1], ids[idx]] = [ids[idx]!, ids[idx - 1]!]
          await repo.reorderCategories(ids)
          await refresh()
        }}
      >
        Move up
      </Button>
      <Button
        onClick={async () => {
          if (!repo) return
          const siblings = data.categories
            .filter((c) => c.group_id === cat.group_id && !c.hidden)
            .sort((a, b) => a.sort_order - b.sort_order)
          const idx = siblings.findIndex((c) => c.id === cat.id)
          if (idx < 0 || idx >= siblings.length - 1) return
          const ids = siblings.map((c) => c.id)
          ;[ids[idx], ids[idx + 1]] = [ids[idx + 1]!, ids[idx]!]
          await repo.reorderCategories(ids)
          await refresh()
        }}
      >
        Move down
      </Button>
    </div>
  )
}

function ExpectedIncomeField({ initial }: { initial: Centavos | null }) {
  const { repo, refresh } = useBudget()
  const [value, setValue] = useState<Centavos | null>(initial)
  return (
    <>
      <MoneyInput
        label="Expected income"
        value={value}
        onChange={setValue}
        name="expected-income"
      />
      <Button
        onClick={async () => {
          if (!repo || value === null) return
          await repo.setSetting('expected_income_centavos', String(value))
          await refresh()
        }}
      >
        Save expected income
      </Button>
    </>
  )
}

export function PlanInspector({
  selectedIds,
  visibleCategoryIds,
  targetViews,
  targetsByCategory,
  assignText,
  setAssignText,
  onAssign,
  onEditTarget,
  onAutoAssign,
  onMoveMoney,
  onClose,
}: {
  selectedIds: string[]
  visibleCategoryIds: string[]
  targetViews: Record<string, CategoryTargetView>
  targetsByCategory: Map<string, EngineTarget>
  assignText: Centavos | null
  setAssignText: (v: Centavos | null) => void
  onAssign: () => void
  onEditTarget: (categoryId: string) => void
  onAutoAssign: () => void
  onMoveMoney: (toId?: string) => void
  onClose?: () => void
}): ReactNode {
  const { data, view, repo, refresh, month, monthLabel } = useBudget()
  const todayMonth = currentMonthKey()
  const selectedId = selectedIds.length === 1 ? selectedIds[0]! : null

  const snapshot = useMemo(() => (data ? toEngineSnapshot(data) : null), [data])

  const cost = useMemo(() => {
    if (!snapshot || !data) return null
    const raw = settingValue(data.settings, 'expected_income_centavos')
    const income = raw !== null && Number.isSafeInteger(Number(raw)) ? Number(raw) : 0
    return costToBeMe(snapshot, month, todayMonth, income)
  }, [snapshot, data, month, todayMonth])

  const expectedIncomeInitial = useMemo(() => {
    if (!data) return null
    const raw = settingValue(data.settings, 'expected_income_centavos')
    if (raw === null) return null
    const n = Number(raw)
    return Number.isSafeInteger(n) ? (n as Centavos) : null
  }, [data])

  const futureMonths = useMemo(() => {
    if (!snapshot) return []
    const months = new Set<string>()
    for (const a of snapshot.assignments) {
      if (a.month > month) months.add(a.month)
    }
    return [...months].sort().map((m) => {
      const mv = computeMonth(snapshot, m)
      return { month: m, assigned: mv.summary.assigned, readyToAssign: mv.readyToAssign }
    })
  }, [snapshot, month])

  const visibleSummary = useMemo(() => {
    if (!view) return null
    let leftOver = 0
    let assigned = 0
    let activity = 0
    let available = 0
    for (const id of visibleCategoryIds) {
      const cm = view.categories[id]
      if (!cm) continue
      leftOver += cm.carried
      assigned += cm.assigned
      activity += cm.activity
      available += cm.available
    }
    return { leftOver, assigned, activity, available }
  }, [view, visibleCategoryIds])

  if (!data || !view) return null

  const selected = selectedId ? view.categories[selectedId] : null
  const selectedCat = data.categories.find((c) => c.id === selectedId)
  const pinned = selectedId ? data.pins.some((p) => p.category_id === selectedId) : false
  const target = selectedId ? targetsByCategory.get(selectedId) : undefined
  const tv = selectedId ? targetViews[selectedId] : undefined
  const currentGoalId = settingValue(data.settings, 'current_goal_category_id')

  if (selectedIds.length > 1) {
    let assigned = 0
    let available = 0
    let activity = 0
    for (const id of selectedIds) {
      const cm = view.categories[id]
      if (!cm) continue
      assigned += cm.assigned
      available += cm.available
      activity += cm.activity
    }
    return (
      <Card>
        <h2 className="plan-inspector-title">{selectedIds.length} categories</h2>
        <dl className="plan-breakdown">
          <div>
            <dt>Assigned</dt>
            <dd>
              <Amount centavos={assigned} />
            </dd>
          </div>
          <div>
            <dt>Activity</dt>
            <dd>
              <Amount centavos={activity} />
            </dd>
          </div>
          <div>
            <dt>Available</dt>
            <dd>
              <Amount centavos={available} />
            </dd>
          </div>
        </dl>
        <Button variant="primary" onClick={onAutoAssign}>
          Auto-Assign selected
        </Button>
      </Card>
    )
  }

  if (selected && selectedCat) {
    const neededText = tv ? neededCaption(tv.needed, target) : null
    const snoozeOk = canSnooze(selectedCat.kind, month, todayMonth)
    return (
      <Card>
        <h2 className="plan-inspector-title">{selectedCat.name}</h2>
        <p>
          Available <Amount centavos={selected.available} />
        </p>
        {neededText ? <p className="plan-needed">{neededText}</p> : null}
        {selected.available < 0 ? (
          <div className="plan-cover-banner">
            <p>This category is overspent.</p>
            <Button onClick={() => onMoveMoney(selectedCat.id)}>Cover overspending</Button>
          </div>
        ) : null}

        <section className="plan-inspector-section">
          <h3>Target</h3>
          <div className="plan-cat-actions">
            <Button onClick={() => onEditTarget(selectedCat.id)}>
              {target ? 'Edit target' : 'Add target'}
            </Button>
            {target && snoozeOk ? (
              <Button
                onClick={async () => {
                  if (!repo) return
                  if (tv?.snoozed) await repo.unsnoozeTarget(selectedCat.id, month)
                  else await repo.snoozeTarget(selectedCat.id, month)
                  await refresh()
                }}
              >
                {tv?.snoozed ? 'Unsnooze' : 'Snooze this month'}
              </Button>
            ) : null}
            {target ? (
              <Button
                onClick={async () => {
                  if (!repo) return
                  await repo.setSetting('current_goal_category_id', selectedCat.id)
                  await refresh()
                }}
              >
                {currentGoalId === selectedCat.id ? 'Current goal' : 'Set as current goal'}
              </Button>
            ) : null}
            <Button onClick={onAutoAssign}>Auto-Assign for category</Button>
          </div>
        </section>

        <dl className="plan-breakdown">
          <div>
            <dt>Left over</dt>
            <dd>
              <Amount centavos={selected.carried} />
            </dd>
          </div>
          <div>
            <dt>Assigned</dt>
            <dd>
              <Amount centavos={selected.assigned} />
            </dd>
          </div>
          <div>
            <dt>Cash spending</dt>
            <dd>
              <Amount centavos={selected.cashActivity} />
            </dd>
          </div>
          <div>
            <dt>Credit spending</dt>
            <dd>
              <Amount centavos={selected.creditActivity} />
            </dd>
          </div>
        </dl>
        <MoneyInput
          label="Assign"
          value={assignText}
          onChange={setAssignText}
          name="assign-amount"
        />
        <Button variant="primary" onClick={() => onAssign()}>
          Save assignment
        </Button>

        <CategoryExtras key={selectedCat.id} cat={selectedCat} pinned={pinned} onClose={onClose} />
      </Card>
    )
  }

  return (
    <Card>
      <h2>Month summary</h2>

      <section className="plan-inspector-section">
        <h3>Cost to Be Me</h3>
        <ExpectedIncomeField
          key={String(expectedIncomeInitial ?? 'empty')}
          initial={expectedIncomeInitial}
        />
        {cost ? (
          <dl className="plan-breakdown">
            <div>
              <dt>This month&apos;s targets</dt>
              <dd>
                <Amount centavos={cost.thisMonth} />
              </dd>
            </div>
            {cost.nextMonth !== null ? (
              <div>
                <dt>Next month&apos;s targets</dt>
                <dd>
                  <Amount centavos={cost.nextMonth} />
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Margin</dt>
              <dd>
                <Amount centavos={cost.margin} />
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <Button variant="primary" onClick={onAutoAssign}>
        Auto-Assign
      </Button>
      <Button onClick={() => onMoveMoney()}>Move money</Button>

      <section className="plan-inspector-section">
        <h3>Available in {monthLabel}</h3>
        <dl className="plan-breakdown">
          <div>
            <dt>Left over</dt>
            <dd>
              <Amount centavos={visibleSummary?.leftOver ?? view.summary.leftOver} />
            </dd>
          </div>
          <div>
            <dt>Assigned</dt>
            <dd>
              <Amount centavos={visibleSummary?.assigned ?? view.summary.assigned} />
            </dd>
          </div>
          <div>
            <dt>Activity</dt>
            <dd>
              <Amount centavos={visibleSummary?.activity ?? view.summary.activity} />
            </dd>
          </div>
          <div>
            <dt>Available</dt>
            <dd>
              <Amount centavos={visibleSummary?.available ?? view.summary.available} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="plan-inspector-section">
        <h3>Assigned in the Future</h3>
        {futureMonths.length === 0 ? (
          <p className="empty-state">Nothing assigned in future months.</p>
        ) : (
          <ul className="plan-future-list">
            {futureMonths.map((fm) => (
              <li key={fm.month}>
                <span>{fm.month}</span>
                <span className="font-money">{formatMoney(fm.assigned)}</span>
                {fm.readyToAssign < 0 ? (
                  <span className="plan-future-alert" role="status">
                    Ready to Assign {formatMoney(fm.readyToAssign)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="ink-2">
          Total assigned ahead: <Amount centavos={view.summary.assignedInFuture} />
        </p>
      </section>
    </Card>
  )
}
