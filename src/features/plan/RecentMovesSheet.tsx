import { useId, useMemo, useState } from 'react'
import { ArrowLeftRight, Banknote, Trash2, Zap } from 'lucide-react'
import { formatMoney } from '../../domain/money.ts'
import type { AssignmentRow, MoveKind, MoveRow } from '../../storage/types.ts'
import { Button } from '../../ui/components/Button.tsx'
import { Chip } from '../../ui/components/Chip.tsx'
import { Sheet } from '../../ui/components/Sheet.tsx'
import './plan.css'

type MoveFilter = 'all' | 'moved' | 'assigned'

type RecentMove = MoveRow & { entries: AssignmentRow[] }

function moveKindLabel(kind: MoveKind): string {
  switch (kind) {
    case 'assign':
      return 'Assigned'
    case 'auto_assign':
      return 'Auto-Assign'
    case 'cover':
      return 'Cover'
    case 'move':
      return 'Moved'
    case 'delete_category':
      return 'Category deleted'
    default:
      return kind
  }
}

function MoveIcon({ kind }: { kind: MoveKind }) {
  const size = 16
  const stroke = 1.5
  switch (kind) {
    case 'auto_assign':
      return <Zap size={size} strokeWidth={stroke} aria-hidden />
    case 'cover':
    case 'move':
      return <ArrowLeftRight size={size} strokeWidth={stroke} aria-hidden />
    case 'delete_category':
      return <Trash2 size={size} strokeWidth={stroke} aria-hidden />
    default:
      return <Banknote size={size} strokeWidth={stroke} aria-hidden />
  }
}

export function RecentMovesSheet({
  open,
  onClose,
  moves,
  categoryNames,
  onJumpToCategory,
  onUndoLatest,
  canUndoLatest,
}: {
  open: boolean
  onClose: () => void
  moves: RecentMove[]
  categoryNames: Record<string, string>
  onJumpToCategory: (categoryId: string) => void
  onUndoLatest: () => Promise<void>
  canUndoLatest: boolean
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Recent Moves">
      {open ? (
        <RecentMovesBody
          key="recent-open"
          moves={moves}
          categoryNames={categoryNames}
          onJumpToCategory={onJumpToCategory}
          onUndoLatest={onUndoLatest}
          canUndoLatest={canUndoLatest}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  )
}

function RecentMovesBody({
  moves,
  categoryNames,
  onJumpToCategory,
  onUndoLatest,
  canUndoLatest,
  onClose,
}: {
  moves: RecentMove[]
  categoryNames: Record<string, string>
  onJumpToCategory: (categoryId: string) => void
  onUndoLatest: () => Promise<void>
  canUndoLatest: boolean
  onClose: () => void
}) {
  const [filter, setFilter] = useState<MoveFilter>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const listId = useId()

  const filtered = useMemo(() => {
    return moves.filter((m) => {
      if (m.undone_at) return false
      if (filter === 'all') return true
      if (filter === 'assigned') return m.kind === 'assign' || m.kind === 'auto_assign'
      return m.kind === 'move' || m.kind === 'cover' || m.kind === 'delete_category'
    })
  }, [moves, filter])

  const latestId = filtered[0]?.id

  return (
    <>
      <div className="plan-filters" role="group" aria-label="Move filters">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </Chip>
        <Chip selected={filter === 'moved'} onClick={() => setFilter('moved')}>
          Moved
        </Chip>
        <Chip selected={filter === 'assigned'} onClick={() => setFilter('assigned')}>
          Assigned
        </Chip>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">No moves in the last 34 days.</p>
      ) : (
        <ul className="plan-moves-list" aria-labelledby={listId}>
          <li className="visually-hidden" id={listId}>
            Recent moves
          </li>
          {filtered.map((m) => {
            const active = m.entries.filter((e) => e.deleted_at === null)
            const byCat = new Map<string, number>()
            for (const e of active) {
              byCat.set(e.category_id, (byCat.get(e.category_id) ?? 0) + e.delta_centavos)
            }
            const cats = [...byCat.entries()]
            const isExpanded = expanded[m.id] === true
            const date = m.created_at.slice(0, 10)
            return (
              <li key={m.id} className="plan-move-row">
                <div className="plan-move-main">
                  <span className="plan-move-icon" title={moveKindLabel(m.kind)}>
                    <MoveIcon kind={m.kind} />
                    <span className="visually-hidden">{moveKindLabel(m.kind)}</span>
                  </span>
                  <div>
                    <p className="plan-move-title">
                      {moveKindLabel(m.kind)} · {m.month}
                    </p>
                    <p className="ink-2 plan-move-meta">{date}</p>
                    {cats.length === 1 ? (
                      <button
                        type="button"
                        className="plan-cat-btn"
                        onClick={() => {
                          onJumpToCategory(cats[0]![0])
                          onClose()
                        }}
                      >
                        {categoryNames[cats[0]![0]] ?? cats[0]![0]}{' '}
                        <span className="font-money">{formatMoney(cats[0]![1])}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="plan-cat-btn"
                        aria-expanded={isExpanded}
                        onClick={() => setExpanded((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                      >
                        {cats.length} categories
                      </button>
                    )}
                    {isExpanded
                      ? cats.map(([id, delta]) => (
                          <button
                            key={id}
                            type="button"
                            className="plan-cat-btn plan-move-sub"
                            onClick={() => {
                              onJumpToCategory(id)
                              onClose()
                            }}
                          >
                            {categoryNames[id] ?? id}{' '}
                            <span className="font-money">{formatMoney(delta)}</span>
                          </button>
                        ))
                      : null}
                  </div>
                  {m.id === latestId && canUndoLatest ? (
                    <Button
                      onClick={() => {
                        void onUndoLatest()
                      }}
                    >
                      Undo
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
