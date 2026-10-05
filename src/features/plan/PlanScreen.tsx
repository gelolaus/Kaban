import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useBudget } from '../../state/BudgetContext.tsx'
import { useInspector } from '../../app/InspectorContext.tsx'
import { Amount } from '../../ui/components/Amount.tsx'
import { Button } from '../../ui/components/Button.tsx'
import { Card } from '../../ui/components/Card.tsx'
import { Chip } from '../../ui/components/Chip.tsx'
import { Field } from '../../ui/components/Field.tsx'
import { StatusPill } from '../../ui/components/StatusPill.tsx'
import { ProgressBar } from '../../ui/components/ProgressBar.tsx'
import { MoneyInput } from '../../ui/components/MoneyInput.tsx'
import { Sheet } from '../../ui/components/Sheet.tsx'
import type { Centavos } from '../../domain/money.ts'
import './plan.css'

type Filter = 'all' | 'overspent' | 'underfunded'

function useWideInspector(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1100px)').matches : true,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)')
    const onChange = () => setWide(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}

function InspectorBody({
  selectedId,
  assignText,
  setAssignText,
  onAssign,
  onClose,
}: {
  selectedId: string | null
  assignText: Centavos | null
  setAssignText: (v: Centavos | null) => void
  onAssign: () => void
  onClose?: () => void
}): ReactNode {
  const { data, view, repo, refresh } = useBudget()
  const [rename, setRename] = useState('')

  if (!data || !view) return null

  const selected = selectedId ? view.categories[selectedId] : null
  const selectedCat = data.categories.find((c) => c.id === selectedId)
  const pinned = selectedId ? data.pins.some((p) => p.category_id === selectedId) : false

  if (selected && selectedCat) {
    return (
      <Card>
        <h2 className="plan-inspector-title">{selectedCat.name}</h2>
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
        <Button variant="primary" onClick={() => onAssign()}>
          Save assignment
        </Button>
        {selectedCat.kind === 'normal' ? (
          <div className="plan-cat-actions">
            <Field label="Rename">
              {(control) => (
                <input
                  {...control}
                  className="field-control"
                  name="rename-category"
                  value={rename || selectedCat.name}
                  onChange={(e) => setRename(e.target.value)}
                />
              )}
            </Field>
            <Button
              onClick={async () => {
                if (!repo) return
                const next = (rename || selectedCat.name).trim()
                if (!next || next === selectedCat.name) return
                await repo.renameCategory(selectedCat.id, next)
                setRename('')
                await refresh()
              }}
            >
              Rename category
            </Button>
            <Button
              onClick={async () => {
                if (!repo) return
                await repo.hideCategory(selectedCat.id, true)
                await refresh()
                onClose?.()
              }}
            >
              Hide category
            </Button>
            <Button
              onClick={async () => {
                if (!repo) return
                if (pinned) await repo.unpinCategory(selectedCat.id)
                else await repo.pinCategory(selectedCat.id)
                await refresh()
              }}
            >
              {pinned ? 'Unpin from Home' : 'Pin to Home'}
            </Button>
            <Button
              onClick={async () => {
                if (!repo) return
                const siblings = data.categories
                  .filter((c) => c.group_id === selectedCat.group_id && !c.hidden)
                  .sort((a, b) => a.sort_order - b.sort_order)
                const idx = siblings.findIndex((c) => c.id === selectedCat.id)
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
                  .filter((c) => c.group_id === selectedCat.group_id && !c.hidden)
                  .sort((a, b) => a.sort_order - b.sort_order)
                const idx = siblings.findIndex((c) => c.id === selectedCat.id)
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
        ) : null}
      </Card>
    )
  }

  return (
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
  )
}

export function PlanScreen() {
  const { data, view, monthLabel, shiftMonth, repo, refresh, month } = useBudget()
  const wide = useWideInspector()
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assignText, setAssignText] = useState<Centavos | null>(null)
  const [groupName, setGroupName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [categoryGroupId, setCategoryGroupId] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)

  const inspector = useMemo(
    () => (
      <InspectorBody
        selectedId={selectedId}
        assignText={assignText}
        setAssignText={setAssignText}
        onAssign={() => {
          void (async () => {
            if (!repo || !selectedId || assignText === null) return
            await repo.assign(selectedId, month, assignText)
            setAssignText(null)
            await refresh()
          })()
        }}
        onClose={() => {
          setSelectedId(null)
          setSheetOpen(false)
        }}
      />
    ),
    [selectedId, assignText, repo, month, refresh],
  )

  useInspector(wide ? inspector : null)

  if (!data || !view) {
    return (
      <>
        <h1 tabIndex={-1}>Plan</h1>
        <p>Loading budget.</p>
      </>
    )
  }

  const groups = data.groups.filter((g) => !g.hidden)
  const defaultGroupId = categoryGroupId || groups[0]?.id || ''

  async function applyAssign() {
    if (!repo || !selectedId || assignText === null) return
    await repo.assign(selectedId, month, assignText)
    setAssignText(null)
    await refresh()
  }

  function selectCategory(id: string) {
    setSelectedId(id)
    setAssignText(null)
    if (!wide) setSheetOpen(true)
  }

  return (
    <div className="plan-screen">
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
            <h1 className="plan-month-title" tabIndex={-1}>
              {monthLabel}
            </h1>
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
        <div
          className="plan-rta"
          data-testid="ready-to-assign"
          {...(view.readyToAssign < 0 ? { 'data-overassigned': '' } : {})}
        >
          <span>
            <span className="plan-rta-amount">
              {view.readyToAssign < 0 ? (
                <svg
                  aria-hidden="true"
                  width="10"
                  height="8"
                  viewBox="0 0 10 8"
                  className="status-marker"
                >
                  <path d="M5 0L10 8H0L5 0Z" fill="currentColor" />
                </svg>
              ) : null}{' '}
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

      <div
        className="plan-phone-banner"
        data-testid="ready-to-assign-phone"
        {...(view.readyToAssign < 0 ? { 'data-overassigned': '' } : {})}
      >
        <span className="plan-rta-amount">
          {view.readyToAssign < 0 ? (
            <svg
              aria-hidden="true"
              width="10"
              height="8"
              viewBox="0 0 10 8"
              className="status-marker"
            >
              <path d="M5 0L10 8H0L5 0Z" fill="currentColor" />
            </svg>
          ) : null}{' '}
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

      <div className="plan-tools">
        <Field label="New group">
          {(control) => (
            <input
              {...control}
              className="field-control"
              name="new-group"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
            />
          )}
        </Field>
        <Button
          onClick={async () => {
            if (!repo || !groupName.trim()) return
            await repo.createCategoryGroup(groupName.trim())
            setGroupName('')
            await refresh()
          }}
        >
          Add group
        </Button>
        <Field label="New category">
          {(control) => (
            <input
              {...control}
              className="field-control"
              name="new-category"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Category name"
            />
          )}
        </Field>
        <Field label="In group">
          {(control) => (
            <select
              {...control}
              className="field-control"
              name="category-group"
              value={defaultGroupId}
              onChange={(e) => setCategoryGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Button
          onClick={async () => {
            if (!repo || !categoryName.trim() || !defaultGroupId) return
            await repo.createCategory(defaultGroupId, categoryName.trim())
            setCategoryName('')
            await refresh()
          }}
        >
          Add category
        </Button>
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
                  <Button
                    className="plan-hide-group"
                    onClick={async () => {
                      if (!repo) return
                      await repo.hideCategoryGroup(group.id, true)
                      await refresh()
                    }}
                  >
                    Hide group
                  </Button>
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
                        onClick={() => selectCategory(cat.id)}
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

      {!wide ? (
        <Sheet
          open={sheetOpen && selectedId !== null}
          onClose={() => setSheetOpen(false)}
          title={data.categories.find((c) => c.id === selectedId)?.name ?? 'Category'}
        >
          {inspector}
        </Sheet>
      ) : null}
    </div>
  )
}
