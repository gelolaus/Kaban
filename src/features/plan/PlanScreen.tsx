import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useBudget } from '../../state/BudgetContext.tsx'
import { Amount } from '../../ui/components/Amount.tsx'
import { Button } from '../../ui/components/Button.tsx'
import { Card } from '../../ui/components/Card.tsx'
import { Chip } from '../../ui/components/Chip.tsx'
import { StatusPill } from '../../ui/components/StatusPill.tsx'
import { ProgressBar } from '../../ui/components/ProgressBar.tsx'
import { MoneyInput } from '../../ui/components/MoneyInput.tsx'
import type { Centavos } from '../../domain/money.ts'
import './plan.css'

type Filter = 'all' | 'overspent' | 'underfunded'

export function PlanScreen() {
  const { data, view, monthLabel, shiftMonth, repo, refresh, month } = useBudget()
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assignText, setAssignText] = useState<Centavos | null>(null)

  const selected = useMemo(
    () => (selectedId && view ? view.categories[selectedId] : null),
    [selectedId, view],
  )
  const selectedCat = data?.categories.find((c) => c.id === selectedId)

  if (!data || !view) {
    return (
      <>
        <h1 tabIndex={-1}>Plan</h1>
        <p>Loading budget.</p>
      </>
    )
  }

  const groups = data.groups.filter((g) => !g.hidden)

  async function applyAssign() {
    if (!repo || !selectedId || assignText === null) return
    await repo.assign(selectedId, month, assignText)
    setAssignText(null)
    await refresh()
  }

  return (
    <div className="plan-screen">
      <h1 className="visually-hidden" tabIndex={-1}>
        Plan
      </h1>
      <div className="plan-top">
        <div className="plan-month">
          <button
            type="button"
            className="plan-circ"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden />
          </button>
          <div>
            <div className="plan-month-title">{monthLabel}</div>
          </div>
          <button
            type="button"
            className="plan-circ"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <div className="plan-rta" data-testid="ready-to-assign">
          <span>
            <span className="plan-rta-amount">
              <Amount centavos={view.readyToAssign} />
            </span>{' '}
            <span className="plan-rta-label">Ready to assign</span>
          </span>
          <Button
            variant="primary"
            onClick={() => {
              if (selectedId) void applyAssign()
            }}
          >
            Assign
          </Button>
        </div>
      </div>

      <div className="plan-phone-banner" data-testid="ready-to-assign-phone">
        <span className="plan-rta-amount">
          <Amount centavos={view.readyToAssign} />
        </span>
        <span>Ready to assign</span>
      </div>

      <div className="plan-filters">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </Chip>
        <Chip selected={filter === 'overspent'} onClick={() => setFilter('overspent')}>
          Overspent
        </Chip>
        <Chip selected={filter === 'underfunded'} onClick={() => setFilter('underfunded')}>
          Underfunded
        </Chip>
      </div>

      <table className="plan-table">
        <caption className="visually-hidden">Budget categories for {monthLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Assigned</th>
            <th scope="col">Activity</th>
            <th scope="col">Available</th>
          </tr>
        </thead>
        {groups.map((group) => {
          const cats = data.categories.filter((c) => c.group_id === group.id && !c.hidden)
          const filtered = cats.filter((c) => {
            const cm = view.categories[c.id]
            if (!cm) return false
            if (filter === 'overspent') return cm.available < 0
            if (filter === 'underfunded') return false // placeholder until targets
            return true
          })
          if (filtered.length === 0 && filter !== 'all') return null
          const isPayment = filtered.every((c) => c.kind === 'credit_card_payment')
          return (
            <tbody key={group.id} className="plan-group">
              <tr className="plan-group-header">
                <th scope="rowgroup" colSpan={4}>
                  <span>{group.name}</span>
                  <span className="plan-group-caption ink-2">
                    {isPayment ? 'Available for payment' : 'Available to spend'}
                  </span>
                </th>
              </tr>
              {filtered.map((cat) => {
                const cm = view.categories[cat.id]!
                const kind = cm.available < 0 ? 'overspent' : cm.available === 0 ? 'zero' : 'funded'
                return (
                  <tr
                    key={cat.id}
                    className={selectedId === cat.id ? 'plan-row-selected' : undefined}
                  >
                    <th scope="row">
                      <button
                        type="button"
                        className="plan-cat-btn"
                        onClick={() => setSelectedId(cat.id)}
                      >
                        {cat.name}
                      </button>
                      {cm.available < 0 ? (
                        <div className="plan-sub">
                          <ProgressBar
                            value={Math.abs(cm.activity)}
                            max={Math.abs(cm.activity) || 1}
                            tone="danger"
                            label={`${cat.name} overspent`}
                          />
                        </div>
                      ) : null}
                    </th>
                    <td>
                      <Amount centavos={cm.assigned} />
                    </td>
                    <td>
                      <Amount centavos={cm.activity} />
                    </td>
                    <td>
                      <StatusPill kind={kind} centavos={cm.available} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          )
        })}
      </table>

      <aside className="plan-inspector-inline" aria-label="Category inspector">
        {selected && selectedCat ? (
          <Card>
            <h2>{selectedCat.name}</h2>
            <p>
              Available <Amount centavos={selected.available} />
            </p>
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
            <Button variant="primary" onClick={() => void applyAssign()}>
              Save assignment
            </Button>
          </Card>
        ) : (
          <Card>
            <h2>Month summary</h2>
            <dl className="plan-breakdown">
              <div>
                <dt>Left over</dt>
                <dd>
                  <Amount centavos={view.summary.leftOver} />
                </dd>
              </div>
              <div>
                <dt>Assigned</dt>
                <dd>
                  <Amount centavos={view.summary.assigned} />
                </dd>
              </div>
              <div>
                <dt>Activity</dt>
                <dd>
                  <Amount centavos={view.summary.activity} />
                </dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd>
                  <Amount centavos={view.summary.available} />
                </dd>
              </div>
            </dl>
          </Card>
        )}
      </aside>
    </div>
  )
}
