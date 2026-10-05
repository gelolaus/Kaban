import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createContext } from 'react'
import { openDatabase, TabAlreadyOpenError, type Db } from '../storage/db.ts'
import { BudgetRepository } from '../storage/repository.ts'
import { balancesFor, loadBudgetData, monthViewFor, type BudgetData } from './budgetMath.ts'
import type { MonthView } from '../engine/types.ts'
import {
  addMonths,
  formatMonth,
  initTemporal,
  isoMonth,
  parseIsoMonth,
  temporal,
} from '../domain/dates.ts'

interface BudgetContextValue {
  status: 'loading' | 'ready' | 'tab-blocked' | 'error'
  errorMessage: string | null
  data: BudgetData | null
  repo: BudgetRepository | null
  month: string
  monthLabel: string
  view: MonthView | null
  balances: Record<string, number>
  setMonth: (m: string) => void
  shiftMonth: (delta: number) => void
  refresh: () => Promise<void>
}

const BudgetContext = createContext<BudgetContextValue | null>(null)

function currentMonthKey(): string {
  const t = temporal()
  const today = t.Now.plainDateISO()
  return isoMonth(t.PlainYearMonth.from({ year: today.year, month: today.month }))
}

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BudgetContextValue['status']>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [repo, setRepo] = useState<BudgetRepository | null>(null)
  const [, setDb] = useState<Db | null>(null)
  const [data, setData] = useState<BudgetData | null>(null)
  const [month, setMonth] = useState('2026-10')

  const refresh = useCallback(async () => {
    if (!repo) return
    setData(await loadBudgetData(repo))
  }, [repo])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await initTemporal()
        if (!cancelled) setMonth(currentMonthKey())
        const database = await openDatabase()
        if (cancelled) return
        setDb(database)
        const r = await BudgetRepository.ensureBudget(database)
        if (cancelled) return
        setRepo(r)
        setData(await loadBudgetData(r))
        if (!cancelled) setStatus('ready')
      } catch (err) {
        if (cancelled) return
        if (err instanceof TabAlreadyOpenError) {
          setStatus('tab-blocked')
          setErrorMessage(err.message)
        } else {
          setStatus('error')
          setErrorMessage(err instanceof Error ? err.message : String(err))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const view = useMemo(() => (data ? monthViewFor(data, month) : null), [data, month])
  const balances = useMemo(() => (data ? balancesFor(data) : {}), [data])

  const monthLabel = useMemo(() => {
    const parsed = parseIsoMonth(month)
    return parsed.ok ? formatMonth(parsed.value) : month
  }, [month])

  const shiftMonth = useCallback(
    (delta: number) => {
      const parsed = parseIsoMonth(month)
      if (!parsed.ok) return
      const next = addMonths(parsed.value, delta)
      const cur = parseIsoMonth(currentMonthKey())
      if (!cur.ok) return
      const max = addMonths(cur.value, 1)
      if (delta > 0 && next.toString() > max.toString()) return
      setMonth(isoMonth(next))
    },
    [month],
  )

  const value: BudgetContextValue = {
    status,
    errorMessage,
    data,
    repo,
    month,
    monthLabel,
    view,
    balances,
    setMonth,
    shiftMonth,
    refresh,
  }

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext)
  if (!ctx) throw new Error('useBudget requires BudgetProvider')
  return ctx
}
