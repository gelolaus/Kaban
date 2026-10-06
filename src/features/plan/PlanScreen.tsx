import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Centavos } from '../../domain/money.ts'
import { formatMoney } from '../../domain/money.ts'
import { moveMoneyPreview } from '../../engine/autoAssign.ts'
import { computeTargets } from '../../engine/targets.ts'
import type { EngineTarget, TargetStatus } from '../../engine/types.ts'
import { currentMonthKey, useBudget } from '../../state/BudgetContext.tsx'
import { toEngineSnapshot } from '../../state/budgetMath.ts'
import { useInspector } from '../../app/InspectorContext.tsx'
import { Amount } from '../../ui/components/Amount.tsx'
import { Button } from '../../ui/components/Button.tsx'
import { Chip } from '../../ui/components/Chip.tsx'
import { Field } from '../../ui/components/Field.tsx'
import { StatusPill, type StatusKind } from '../../ui/components/StatusPill.tsx'
import { ProgressBar } from '../../ui/components/ProgressBar.tsx'
import { Sheet } from '../../ui/components/Sheet.tsx'
import { AutoAssignDialog } from './AutoAssignDialog.tsx'
import { MoveMoneyDialog } from './MoveMoneyDialog.tsx'
import { PlanInspector } from './PlanInspector.tsx'
import { RecentMovesSheet } from './RecentMovesSheet.tsx'
import { TargetEditor } from './TargetEditor.tsx'
import { TargetStatusIcon } from './TargetStatusIcon.tsx'
import { settingValue } from './targetCopy.ts'
import './plan.css'

type Filter = 'all' | 'overspent' | 'underfunded' | 'overfunded' | 'available' | 'snoozed'

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

function usePhoneDefault(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 760px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)')
    const onChange = () => setPhone(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return phone
}

function statusToPill(status: TargetStatus | undefined, available: number): StatusKind {
  if (status) return status
  if (available < 0) return 'overspent'
  if (available === 0) return 'zero'
  return 'positive'
}

function isOverfunded(
  assigned: number,
  available: number,
  askThisMonth: number | undefined,
  needed: number | undefined,
): boolean {
  if (available <= 0) return false
  if (askThisMonth === undefined) return false
  if ((needed ?? 0) > 0) return false
  return assigned > askThisMonth
}

function isTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

export function PlanScreen() {
  const { data, view, monthLabel, shiftMonth, repo, refresh, month } = useBudget()
  const wide = useWideInspector()
  const phone = usePhoneDefault()
  const todayMonth = currentMonthKey()

  const [filter, setFilter] = useState<Filter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [assignText, setAssignText] = useState<Centavos | null>(null)
  const [groupName, setGroupName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [categoryGroupId, setCategoryGroupId] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [targetEditorCatId, setTargetEditorCatId] = useState<string | null>(null)
  const [autoAssignOpen, setAutoAssignOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveDefaultTo, setMoveDefaultTo] = useState<string | null>(null)
  const [recentOpen, setRecentOpen] = useState(false)
  const [recentMoves, setRecentMoves] = useState<
    Awaited<ReturnType<NonNullable<typeof repo>['listRecentMoves']>>
  >([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const snapshot = useMemo(() => (data ? toEngineSnapshot(data) : null), [data])

  const targetViews = useMemo(() => {
    if (!snapshot) return {}
    return computeTargets(snapshot, month, todayMonth)
  }, [snapshot, month, todayMonth])

  const targetsByCategory = useMemo(() => {
    const map = new Map<string, EngineTarget>()
    for (const t of snapshot?.targets ?? []) map.set(t.categoryId, t)
    return map
  }, [snapshot])

  const showProgressBars = useMemo(() => {
    if (!data) return phone
    const raw = settingValue(data.settings, 'progress_bars')
    if (raw === '1') return true
    if (raw === '0') return false
    return phone
  }, [data, phone])

  const refreshUndo = useCallback(async () => {
    if (!repo) return
    setCanUndo(await repo.canUndo())
    setCanRedo(await repo.canRedo())
  }, [repo])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!repo) return
      const [u, r] = await Promise.all([repo.canUndo(), repo.canRedo()])
      if (cancelled) return
      setCanUndo(u)
      setCanRedo(r)
    })()
    return () => {
      cancelled = true
    }
  }, [repo, data])

  const loadRecent = useCallback(async () => {
    if (!repo) return
    const since = new Date()
    since.setDate(since.getDate() - 34)
    const moves = await repo.listRecentMoves(since.toISOString())
    setRecentMoves(moves)
  }, [repo])

  const doUndo = useCallback(async () => {
    if (!repo) return
    await repo.undoLastMove()
    await refresh()
    await refreshUndo()
    await loadRecent()
  }, [repo, refresh, refreshUndo, loadRecent])

  const doRedo = useCallback(async () => {
    if (!repo) return
    await repo.redoLastMove()
    await refresh()
    await refreshUndo()
    await loadRecent()
  }, [repo, refresh, refreshUndo, loadRecent])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTextField(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        void doUndo()
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault()
        void doRedo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doUndo, doRedo])

  const groups = useMemo(() => data?.groups.filter((g) => !g.hidden) ?? [], [data])

  const categoryNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of data?.categories ?? []) map[c.id] = c.name
    return map
  }, [data])

  const matchesFilter = useCallback(
    (categoryId: string): boolean => {
      if (!view) return false
      const cm = view.categories[categoryId]
      if (!cm) return false
      const tv = targetViews[categoryId]
      switch (filter) {
        case 'overspent':
          return cm.available < 0 || cm.cashOverspending > 0
        case 'underfunded':
          return (tv?.needed ?? 0) > 0
        case 'overfunded':
          return isOverfunded(cm.assigned, cm.available, tv?.askThisMonth, tv?.needed)
        case 'available':
          return cm.available > 0
        case 'snoozed':
          return tv?.snoozed === true
        default:
          return true
      }
    },
    [view, targetViews, filter],
  )

  const visibleCategoryIds = useMemo(() => {
    if (!data) return []
    return data.categories.filter((c) => !c.hidden && matchesFilter(c.id)).map((c) => c.id)
  }, [data, matchesFilter])

  const coverTargets = useMemo(() => {
    if (!view || month !== todayMonth) return []
    return visibleCategoryIds
      .map((id) => {
        const cm = view.categories[id]
        if (!cm || cm.available >= 0) return null
        return { categoryId: id, amount: -cm.available }
      })
      .filter((x): x is { categoryId: string; amount: number } => x !== null)
  }, [view, visibleCategoryIds, month, todayMonth])

  const autoAssignScope = useMemo(() => {
    if (selectedIds.length > 0) return { categoryIds: selectedIds }
    return { categoryIds: visibleCategoryIds }
  }, [selectedIds, visibleCategoryIds])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const toggleGroup = useCallback(
    (groupId: string) => {
      if (!data) return
      const ids = data.categories
        .filter((c) => c.group_id === groupId && !c.hidden && matchesFilter(c.id))
        .map((c) => c.id)
      setSelectedIds((prev) => {
        const allSelected = ids.every((id) => prev.includes(id))
        if (allSelected) return prev.filter((id) => !ids.includes(id))
        return [...new Set([...prev, ...ids])]
      })
    },
    [data, matchesFilter],
  )

  const openCategory = useCallback(
    (id: string) => {
      setSelectedIds([id])
      setAssignText(null)
      if (!wide) setSheetOpen(true)
    },
    [wide],
  )

  const inspector = useMemo(
    () => (
      <PlanInspector
        selectedIds={selectedIds}
        visibleCategoryIds={visibleCategoryIds}
        targetViews={targetViews}
        targetsByCategory={targetsByCategory}
        assignText={assignText}
        setAssignText={setAssignText}
        onAssign={() => {
          void (async () => {
            if (!repo || selectedIds.length !== 1 || assignText === null) return
            await repo.assign(selectedIds[0]!, month, assignText)
            setAssignText(null)
            await refresh()
            await refreshUndo()
          })()
        }}
        onEditTarget={(id) => setTargetEditorCatId(id)}
        onAutoAssign={() => setAutoAssignOpen(true)}
        onMoveMoney={(toId) => {
          setMoveDefaultTo(toId ?? null)
          setMoveOpen(true)
        }}
        onClose={() => {
          setSelectedIds([])
          setSheetOpen(false)
        }}
      />
    ),
    [
      selectedIds,
      visibleCategoryIds,
      targetViews,
      targetsByCategory,
      assignText,
      repo,
      month,
      refresh,
      refreshUndo,
    ],
  )

  useInspector(wide ? inspector : null)

  if (!data || !view || !snapshot) {
    return (
      <>
        <h1 tabIndex={-1}>Plan</h1>
        <p>Loading budget.</p>
      </>
    )
  }

  const defaultGroupId = categoryGroupId || groups[0]?.id || ''
  const editorCat = targetEditorCatId
    ? data.categories.find((c) => c.id === targetEditorCatId)
    : null
  const editorTarget = targetEditorCatId ? (targetsByCategory.get(targetEditorCatId) ?? null) : null

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
          <Button variant="primary" onClick={() => setAutoAssignOpen(true)}>
            Auto-Assign
          </Button>
        </div>
      </div>

      <button
        type="button"
        className="plan-phone-banner"
        data-testid="ready-to-assign-phone"
        {...(view.readyToAssign < 0 ? { 'data-overassigned': '' } : {})}
        onClick={() => setAutoAssignOpen(true)}
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
      </button>

      <div className="plan-filters" role="group" aria-label="Plan filters">
        {(
          [
            ['all', 'All'],
            ['overspent', 'Overspent'],
            ['underfunded', 'Underfunded'],
            ['overfunded', 'Overfunded'],
            ['available', 'Money available'],
            ['snoozed', 'Snoozed'],
          ] as const
        ).map(([id, label]) => (
          <Chip key={id} selected={filter === id} onClick={() => setFilter(id)}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="plan-toolbar">
        <Button onClick={() => void doUndo()} disabled={!canUndo}>
          Undo
        </Button>
        <Button onClick={() => void doRedo()} disabled={!canRedo}>
          Redo
        </Button>
        <Button
          onClick={() => {
            void loadRecent().then(() => setRecentOpen(true))
          }}
        >
          Recent Moves
        </Button>
        <Button
          onClick={() => {
            setMoveDefaultTo(null)
            setMoveOpen(true)
          }}
        >
          Move money
        </Button>
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
            <th scope="col">
              <span className="visually-hidden">Select</span>
            </th>
            <th scope="col">Category</th>
            <th scope="col">Assigned</th>
            <th scope="col">Activity</th>
            <th scope="col">Available</th>
          </tr>
        </thead>
        {groups.map((group) => {
          const cats = data.categories.filter(
            (c) => c.group_id === group.id && !c.hidden && matchesFilter(c.id),
          )
          if (cats.length === 0 && filter !== 'all') return null
          const isPayment = cats.every((c) => c.kind === 'credit_card_payment')
          const groupIds = cats.map((c) => c.id)
          const groupChecked =
            groupIds.length > 0 && groupIds.every((id) => selectedIds.includes(id))
          return (
            <tbody key={group.id} className="plan-group">
              <tr className="plan-group-header">
                <th scope="rowgroup" colSpan={5}>
                  <label className="plan-check">
                    <input
                      type="checkbox"
                      checked={groupChecked}
                      onChange={() => toggleGroup(group.id)}
                      aria-label={`Select group ${group.name}`}
                    />
                  </label>
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
              {cats.map((cat) => {
                const cm = view.categories[cat.id]!
                const tv = targetViews[cat.id]
                const kind = statusToPill(tv?.status, cm.available)
                const selected = selectedIds.includes(cat.id)
                return (
                  <tr key={cat.id} className={selected ? 'plan-row-selected' : undefined}>
                    <td className="plan-check-cell">
                      <label className="plan-check">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(cat.id)}
                          aria-label={`Select ${cat.name}`}
                        />
                      </label>
                    </td>
                    <th scope="row">
                      <div className="plan-cat-cell">
                        {tv ? <TargetStatusIcon status={tv.status} /> : null}
                        <button
                          type="button"
                          className="plan-cat-btn"
                          onClick={() => openCategory(cat.id)}
                        >
                          {cat.name}
                        </button>
                      </div>
                      {showProgressBars && tv ? (
                        <div className="plan-sub">
                          <ProgressBar
                            value={Math.round(tv.progress * 100)}
                            max={100}
                            tone={cm.available < 0 ? 'danger' : 'normal'}
                            label={`${cat.name} target progress`}
                          />
                        </div>
                      ) : null}
                      {!showProgressBars && cm.available < 0 ? (
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
                      <StatusPill
                        kind={kind}
                        centavos={cm.available}
                        caption={
                          tv && tv.needed > 0 ? `${formatMoney(tv.needed)} more needed` : undefined
                        }
                      />
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
          open={sheetOpen && selectedIds.length === 1}
          onClose={() => setSheetOpen(false)}
          title={data.categories.find((c) => c.id === selectedIds[0])?.name ?? 'Category'}
        >
          {inspector}
        </Sheet>
      ) : null}

      {editorCat ? (
        <TargetEditor
          open={targetEditorCatId !== null}
          categoryId={editorCat.id}
          categoryName={editorCat.name}
          existing={editorTarget}
          onClose={() => setTargetEditorCatId(null)}
          onSave={async (input) => {
            if (!repo) return
            await repo.upsertTarget(input)
            await refresh()
          }}
          onDelete={
            editorTarget
              ? async () => {
                  if (!repo) return
                  await repo.deleteTarget(editorCat.id)
                  await refresh()
                }
              : undefined
          }
        />
      ) : null}

      <AutoAssignDialog
        open={autoAssignOpen}
        onClose={() => setAutoAssignOpen(false)}
        snapshot={snapshot}
        month={month}
        currentMonth={todayMonth}
        scope={autoAssignScope}
        categoryNames={categoryNames}
        onSave={async (deltas) => {
          if (!repo) return
          await repo.recordMove(
            'auto_assign',
            month,
            deltas.map((d) => ({ categoryId: d.categoryId, deltaCentavos: d.delta })),
          )
          await refresh()
          await refreshUndo()
        }}
      />

      <MoveMoneyDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        snapshot={snapshot}
        month={month}
        categories={data.categories
          .filter((c) => !c.hidden)
          .map((c) => ({ id: c.id, name: c.name }))}
        coverTargets={coverTargets}
        defaultToId={moveDefaultTo}
        onSave={async ({ fromCategoryId, toCategoryId, amount, kind }) => {
          if (!repo || !snapshot) return
          const preview = moveMoneyPreview(snapshot, month, fromCategoryId, toCategoryId, amount)
          if (preview.deltas.length === 0) return
          await repo.recordMove(
            kind,
            month,
            preview.deltas.map((d) => ({ categoryId: d.categoryId, deltaCentavos: d.delta })),
          )
          await refresh()
          await refreshUndo()
        }}
      />

      <RecentMovesSheet
        open={recentOpen}
        onClose={() => setRecentOpen(false)}
        moves={recentMoves}
        categoryNames={categoryNames}
        onJumpToCategory={openCategory}
        onUndoLatest={doUndo}
        canUndoLatest={canUndo}
      />
    </div>
  )
}
