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

function themeButtonName(pref: ThemePref, systemIsDark: boolean): string {
  const next = nextThemePref(pref, systemIsDark)
  if (next === 'system') return 'Use system theme'
  if (next === 'dark') return 'Use dark theme'
  return 'Use light theme'
}

export function SettingsScreen() {
  const [pref, setPref] = useState<ThemePref>(() => readThemePref(localStorage))
  const [density, setDensity] = useState<Density>(() => readDensity(localStorage))
  const systemIsDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

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
    </>
  )
}
