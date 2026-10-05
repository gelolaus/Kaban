import { useState } from 'react'
import {
  applyThemePref,
  colorSchemeContent,
  nextThemePref,
  readThemePref,
  type ThemePref,
} from '../../ui/theme.ts'
import { applyDensity, readDensity, type Density } from '../../ui/density.ts'
import { Button } from '../../ui/components/Button.tsx'
import { useBudget } from '../../state/BudgetContext.tsx'
import { showToast } from '../../ui/components/toast.ts'
import {
  BackupValidationError,
  backupReplaceSummary,
  parseBackupPayload,
} from '../../storage/backupValidate.ts'

function themeButtonName(pref: ThemePref, systemIsDark: boolean): string {
  const next = nextThemePref(pref, systemIsDark)
  if (next === 'system') return 'Use system theme'
  if (next === 'dark') return 'Use dark theme'
  return 'Use light theme'
}

function plainError(err: unknown): string {
  if (err instanceof BackupValidationError) return err.message
  if (err instanceof Error && err.message && !err.message.startsWith('Error:')) return err.message
  return 'Could not import the backup.'
}

export function SettingsScreen() {
  const { repo, refresh } = useBudget()
  const [pref, setPref] = useState<ThemePref>(() => readThemePref(localStorage))
  const [density, setDensity] = useState<Density>(() => readDensity(localStorage))
  const systemIsDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

  async function exportBackup() {
    if (!repo) return
    const payload = await repo.exportBackup()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kaban-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Backup exported.')
  }

  async function importBackup(file: File) {
    if (!repo) return
    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      showToast('Backup file is not valid JSON.', { kind: 'error' })
      return
    }

    let payload
    try {
      payload = parseBackupPayload(raw)
    } catch (err) {
      showToast(plainError(err), { kind: 'error' })
      return
    }

    const exportFirst = window.confirm(
      'Export a backup of the current data first? Click OK to export, or Cancel to skip.',
    )
    if (exportFirst) {
      await exportBackup()
    }

    const summary = backupReplaceSummary(payload)
    const ok = window.confirm(
      `Replace all data on this device with this backup (${summary})? This cannot be undone.`,
    )
    if (!ok) return

    try {
      await repo.importBackup(payload)
      await refresh()
      showToast('Backup imported.')
    } catch (err) {
      showToast(plainError(err), { kind: 'error' })
    }
  }

  async function removeData() {
    if (!repo) return
    if (!window.confirm('Remove all Kaban data from this device?')) return
    await repo.clearAllData()
    showToast('Data removed from this device.')
    window.location.reload()
  }

  return (
    <>
      <h1 tabIndex={-1}>Settings</h1>
      <section>
        <h2>Appearance</h2>
        <Button
          onClick={() => {
            const next = nextThemePref(pref, systemIsDark)
            applyThemePref(next, document, localStorage)
            setPref(next)
          }}
        >
          {themeButtonName(pref, systemIsDark)}
        </Button>
        <p className="ink-2">Color scheme: {colorSchemeContent(pref)}</p>
      </section>
      <fieldset>
        <legend>Density</legend>
        <label>
          <input
            type="radio"
            name="density"
            checked={density === 'compact'}
            onChange={() => {
              applyDensity('compact', document, localStorage)
              setDensity('compact')
            }}
          />
          Compact
        </label>
        <label>
          <input
            type="radio"
            name="density"
            checked={density === 'comfortable'}
            onChange={() => {
              applyDensity('comfortable', document, localStorage)
              setDensity('comfortable')
            }}
          />
          Comfortable
        </label>
      </fieldset>
      <section>
        <h2>Backup</h2>
        <Button onClick={() => void exportBackup()}>Export backup</Button>
        <label className="file-label">
          Import backup
          <input
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importBackup(file)
              e.target.value = ''
            }}
          />
        </label>
        <Button onClick={() => void removeData()}>Remove data from this device</Button>
      </section>
    </>
  )
}
