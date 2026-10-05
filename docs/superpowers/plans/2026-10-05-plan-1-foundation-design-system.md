# Plan 1: Foundation and Design System Implementation Plan

> **For Grok in Cursor:** Work through the tasks in order. Do not edit this plan file: keep your progress in the chat (tick steps there). Before starting, read the spec, `docs/guidance/modern-web.md`, `docs/guidance/commit-style.md` and `docs/decisions/0001-storage-and-sync.md` (from Plan 0). Do not run `git add`, `git commit` or `git push`. At every "Commit checkpoint", print the file list and a commit message that you write yourself from the actual diff (follow `docs/guidance/commit-style.md`; the plan's message is only a starting point), then stop and wait for the owner to commit. If a step's expected output does not match, stop and report the actual output instead of guessing.

**Goal:** Build the Kaban app foundation: tooling and guardrails, design tokens and theming, the core accessible components, the responsive app shell (laptop, tablet, phone), PWA setup, and security headers, with placeholder screens.

**Architecture:** One Vite + React + TypeScript package with the folder boundaries from the spec. Plain CSS with cascade layers and custom-property tokens. Pure logic (money, dates, preferences, toast store, CSP hashing) is unit-tested with Vitest. Browser behavior (components, shell, PWA) is tested with Playwright in real Chromium, including axe accessibility checks. No screens have real data yet; each shows a placeholder.

**Tech Stack:** pnpm 12.9.1, Node 24, Vite 8.3.2, React 19.3.0, TypeScript 6.0.3, react-router 8.4.0, lucide-react 1.52.0, Vitest 5.0.3, Playwright 1.63.0 with `@axe-core/playwright` 4.13.0, `vite-plugin-pwa` 2.0.0, ESLint 9.39.5, Stylelint 17.16.0, Prettier 3.9.9.

**Spec:** `docs/superpowers/specs/2026-10-05-kaban-design.md` (sections 3, 6, 7, 8, 9). Rules: `docs/guidance/modern-web.md`. Visual reference (look and structure only, never copy its code): `docs/design/kaban-mock.html`.

## Global Constraints

- Chromium-first (current Chrome and Edge on Windows, Chrome on Android). Firefox and Safari best effort. Load `@oddbird/popover-polyfill` and `@js-temporal/polyfill` only when the browser lacks the feature.
- Plain CSS only: no Tailwind, no CSS-in-JS, no `@import`, no universal selector, no hex colors outside `src/ui/tokens.css`, no `px` font sizes, no `outline: none`. Cascade layer order: `@layer reset, base, tokens, components, utilities;`.
- Money is integer centavos everywhere; entered text is parsed with string logic, never `parseFloat`. Dates are `Temporal.PlainDate`, months are `Temporal.PlainYearMonth`, stored as ISO strings. `Date` is not used for date logic.
- Fonts: Nothing Serif (`--font-serif`, falls back to Newsreader then Georgia) and Geist (`--font-sans`). No monospace face. Self-hosted only. The peso sign `₱` is in the `latin-ext` subsets and the `▲` marker is in neither font, so `▲` is drawn as an inline SVG, never a text glyph.
- Color tokens exactly as in spec section 6.2. `--ink-2` in light mode is `#6B6B6B` (never `#777777`). `--signal` is only a fill with white text, a 1px border or a bar fill; never small text on dark.
- Theme control is two-state ("use system" or "use the opposite"). Density is `compact` (default on laptop) or `comfortable`. Phone always uses touch sizes.
- Touch targets: at least 24 by 24 CSS px; on `pointer: coarse` primary controls are at least 44 px and inputs 48 px. Inputs never use a font size under `1rem` on phone.
- Components never use `innerHTML` or `dangerouslySetInnerHTML`. The budget grid (later plans) is a real `<table>`.
- Copy: sentence case, verb-first buttons, no exclamation marks, no "please" or "successfully"; helper and error text ends with a period.
- Pin exact versions (no `^`, no `latest`). Commit messages follow Conventional Commits; the owner commits.
- pnpm 12 refuses to run dependency build scripts unless they are approved. The only approved packages are `esbuild` and `workerd`, approved with `pnpm approve-builds esbuild workerd` (never `--all`) and recorded in `pnpm-workspace.yaml`. Any other package that asks for approval: stop and ask the owner.

## Review Focus

Failure modes the spec implies but the numbered steps do not exercise, most likely first. Each has a test in the task named.

1. Messy money text from pasting (`₱ 1,200.00`, `1.200,50`, full-width digits, `1e3`, huge numbers, negative zero) must never become a wrong amount (Task 3).
2. A corrupt or foreign value in `localStorage` for theme or density must fall back to the default and never break rendering (Task 4).
3. Closing a sheet with Esc must return focus to the control that opened it and leave the page behind it inert while open (Task 7).
4. Several toasts shown quickly must all be announced once, stack without hiding each other, and the update toast must persist until dismissed (Task 7).
5. After a route change the keyboard user must land on the new view's heading, the title must update, and the skip link must work (Task 9).

## File structure

| Path | Responsibility |
|---|---|
| `package.json`, `.npmrc`, `.nvmrc`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `.prettierrc.json`, `.gitignore` | Tooling |
| `eslint.config.js`, `.stylelintrc.json`, `tools/guardrails.test.ts` | Guardrails and their tests |
| `index.html` | Document shell, color-scheme meta, inline theme script |
| `src/main.tsx` | Entry: layers, fonts, polyfills, Temporal init, mount |
| `src/domain/result.ts`, `money.ts`, `dates.ts` | Result type, money parsing and formatting, Temporal helpers |
| `src/ui/layers.css`, `tokens.css`, `base.css` | Layers, design tokens, element base styles |
| `src/ui/theme.ts`, `density.ts` | Preference logic |
| `src/ui/components/*` | Button, Chip, Card, Amount, StatusPill, ProgressBar, VisuallyHidden, Sheet, Toast, Field, MoneyInput |
| `src/features/gallery/Gallery.tsx` | Dev-only component gallery used by Playwright |
| `src/features/{home,plan,spending,accounts,reflect,settings}/*Screen.tsx` | Placeholder screens |
| `src/app/*` | Shell, routes, nav model, route announcer, PWA registration, storage persistence |
| `scripts/csp.ts`, `scripts/write-headers.ts`, `scripts/make-icons.ts`, `config/headers.template` | Build-time security headers and icons |
| `tests/e2e/*.spec.ts` | Playwright tests |
| `AGENTS.md`, `.cursor/rules/kaban.mdc`, `docs/templates/HANDOFF.md` | Agent instructions |

---

### Task 1: Scaffold and the `pnpm verify` command

**Files:**
- Create: `package.json`, `.npmrc`, `.nvmrc`, `.gitignore`, `.prettierrc.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `src/main.tsx`
- Test: `tools/scripts.test.ts`

**Interfaces:**
- Produces: scripts `dev`, `build`, `typecheck`, `lint`, `lint:css`, `format`, `test`, `test:e2e`, `verify`, `verify:e2e` with the exact definitions below.

- [ ] **Step 1: Write the failing test** `tools/scripts.test.ts`:
  ```ts
  import { readFileSync } from 'node:fs'
  import { expect, test } from 'vitest'
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string>; engines: { node: string }; packageManager: string }
  test('the agreed commands exist', () => {
    for (const name of ['dev', 'build', 'typecheck', 'lint', 'lint:css', 'format', 'test', 'test:e2e', 'verify', 'verify:e2e']) expect(pkg.scripts[name], name).toBeTruthy()
  })
  test('verify runs typecheck, lint, css lint, format check, unit tests, and build in that order', () => {
    expect(pkg.scripts.verify).toBe('pnpm typecheck && pnpm lint && pnpm lint:css && pnpm format && pnpm test && pnpm build')
  })
  test('toolchain is pinned', () => {
    expect(pkg.packageManager).toBe('pnpm@12.9.1')
    expect(pkg.engines.node).toBe('>=24')
  })
  ```
- [ ] **Step 2: Run the test to see it fail.** Create a temporary `package.json` containing only `"type": "module"`, a `test` script `vitest run`, and `vitest` 5.0.3 as a dev dependency. Run `pnpm install`, then `pnpm test tools/scripts.test.ts`. Expected: FAIL (the scripts and pins are missing).
- [ ] **Step 3: Create the full package files.** Replace `package.json` with one that has `"type": "module"`, `"private": true`, `engines.node: ">=24"`, `packageManager: "pnpm@12.9.1"`. Scripts: `dev` `vite --port 5173 --strictPort`; `build` `tsc --noEmit && vite build`; `typecheck` `tsc --noEmit`; `lint` `eslint .`; `lint:css` `stylelint "src/**/*.css"`; `format` `prettier --check .`; `test` `vitest run`; `test:e2e` `playwright test`; `verify` exactly as in the test; `verify:e2e` `pnpm verify && pnpm test:e2e`. `dependencies` (exact): `react` 19.3.0, `react-dom` 19.3.0, `react-router` 8.4.0, `lucide-react` 1.52.0, `@js-temporal/polyfill` 0.5.1, `@fontsource-variable/geist` 5.3.0, `@fontsource-variable/newsreader` 5.3.0, `workbox-window` 7.4.1, `@oddbird/popover-polyfill` 0.7.3. `devDependencies` (exact): `vite` 8.3.2, `@vitejs/plugin-react` 6.1.1, `typescript` 6.0.3, `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@types/node` 24.12.2, `vitest` 5.0.3, `@playwright/test` 1.63.0, `@axe-core/playwright` 4.13.0, `vite-plugin-pwa` 2.0.0, `workbox-build` 7.4.1, `eslint` 9.39.5, `@eslint/js` 9.39.5, `typescript-eslint` 8.71.0, `eslint-plugin-react` 7.37.5, `eslint-plugin-react-hooks` 7.1.1, `globals` 17.13.0, `stylelint` 17.16.0, `stylelint-config-standard` 40.0.0, `prettier` 3.9.9, `sharp` 0.35.5, `wrangler` 4.147.0. Other files: `.npmrc` with `engine-strict=true`; `.nvmrc` with `24`; `.gitignore` with `node_modules`, `dist`, `test-results`, `playwright-report`, `.env*`, `.wrangler`; `.prettierrc.json` with `{"semi": false, "singleQuote": true, "printWidth": 100}`. `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`, `skipLibCheck`, `isolatedModules`, `target ES2023`, `module ESNext`, `moduleResolution bundler`, `jsx react-jsx`, `lib ["ES2023","DOM","DOM.Iterable"]`, `types ["vite/client","vite-plugin-pwa/client"]`, `include ["src","tools","scripts","tests","vite.config.ts","playwright.config.ts"]`. `vite.config.ts`: import `defineConfig` from `vitest/config`, plugin `react()`, `test: { include: ['src/**/*.test.ts','tools/**/*.test.ts','scripts/**/*.test.ts'], environment: 'node' }`. `index.html`: `lang="en"`, `<meta charset>`, viewport meta `width=device-width, initial-scale=1, viewport-fit=cover`, `<meta name="color-scheme" content="light dark">`, `<title>Kaban</title>`, a `<div id="root">`, and `<script type="module" src="/src/main.tsx">`. `src/main.tsx` renders `<h1>Kaban</h1>` with `createRoot`. `playwright.config.ts` is created in Task 6. Run `pnpm install`. pnpm 12 blocks dependency build scripts, so it is expected to stop with `ERR_PNPM_IGNORED_BUILDS` naming `esbuild` and `workerd`; approve exactly those two with `pnpm approve-builds esbuild workerd` (this creates `pnpm-workspace.yaml` with `allowBuilds` entries) and run `pnpm install` again. Expected: exit code 0.
- [ ] **Step 4: Run the test again.** Run `pnpm test tools/scripts.test.ts`. Expected: PASS (3 passed).
- [ ] **Step 5: Create the minimal guardrail configs needed for `verify` to pass.** `pnpm lint` and `pnpm lint:css` need configs, so create minimal `eslint.config.js` (`@eslint/js` recommended plus `typescript-eslint` recommended, `ignores: ['dist','node_modules','test-results','playwright-report']`) and `.stylelintrc.json` (`{"extends": ["stylelint-config-standard"]}`). Task 2 replaces both. Create a placeholder `src/ui/layers.css` with `@layer reset, base, tokens, components, utilities;` so the CSS glob matches.
- [ ] **Step 6: Run the full command.** Run `pnpm verify`. Expected: exit code 0, with typecheck, lint, css lint, prettier check, 3 tests passing, and a built `dist/`. Fix formatting with `pnpm exec prettier --write .` if the format step fails.
- [ ] **Step 7: Commit checkpoint.** Files: all created above plus `pnpm-lock.yaml` and `pnpm-workspace.yaml`. Message:
  ```
  chore(config): scaffold vite react app with pinned toolchain and verify command

  - add `pnpm verify` running typecheck, lint, css lint, format check, unit tests, and build
  - pin node 24, pnpm 12.9.1, and every dependency to an exact version
  - cover the agreed script names and pins with Vitest
  ```

### Task 2: Guardrails (lint rules that protect the architecture)

**Files:**
- Modify: `eslint.config.js`, `.stylelintrc.json`
- Test: `tools/guardrails.test.ts`

**Interfaces:**
- Consumes: scripts from Task 1.
- Produces: lint failures for: `engine/` importing React, `react-router`, or any of `storage`, `sync`, `state`, `ui`, `features`, `app`; DOM globals in `engine/`; writing `innerHTML` or `outerHTML`; `document.write`; `dangerouslySetInnerHTML`; and in CSS: `px` font sizes, hex colors outside `src/ui/tokens.css`, universal selectors, `@import`, `outline: none`.

- [ ] **Step 1: Write the failing test** `tools/guardrails.test.ts` using the ESLint and Stylelint Node APIs. ESLint cases use `new ESLint({ cwd: process.cwd() }).lintText(code, { filePath })` and assert the set of `ruleId`s; Stylelint cases use `stylelint.lint({ code, codeFilename, config, configBasedir: process.cwd() })` with the config read from `.stylelintrc.json`:
  | Case (path, code) | Expected rule |
  |---|---|
  | `src/engine/a.ts`, `import React from 'react'` | `no-restricted-imports` |
  | `src/engine/b.ts`, `import { x } from '../storage/db'` | `no-restricted-imports` |
  | `src/engine/c.ts`, `export const c = window.innerWidth` | `no-restricted-globals` |
  | `src/ui/d.ts`, `export function d(el: HTMLElement, s: string) { el.innerHTML = s }` | `no-restricted-syntax` |
  | `src/ui/e.tsx`, a component using `dangerouslySetInnerHTML` | `react/no-danger` |
  | `src/engine/ok.ts`, `export const ok = (a: number, b: number): number => a + b` | none |
  | `src/ui/ok.ts`, `export const w = () => window.innerWidth` | none |
  | CSS `a {\n  font-size: 12px;\n}\n` | `declaration-property-unit-disallowed-list` |
  | CSS `a {\n  color: #fff;\n}\n` | `color-no-hex` |
  | CSS `* {\n  margin: 0;\n}\n` | `selector-max-universal` |
  | CSS `@import "x.css";\n` | `at-rule-disallowed-list` |
  | CSS `a {\n  outline: none;\n}\n` | `declaration-property-value-disallowed-list` |
  | `src/ui/tokens.css`, `:root {\n  --ink: #fff;\n}\n` | none |
  | CSS `a {\n  font-size: 0.8125rem;\n}\n` | none |
- [ ] **Step 2: Run it to see it fail.** Run `pnpm test tools/guardrails.test.ts`. Expected: FAIL on the 12 rules that are not yet configured.
- [ ] **Step 3: Implement `eslint.config.js`** (flat config, `typescript-eslint` recommended plus `@eslint/js` recommended plus `eslint-plugin-react` and `eslint-plugin-react-hooks` recommended). Rules, verified to work with these versions: for all `**/*.{ts,tsx}`: `react/no-danger: error`, `no-eval: error`, `no-implied-eval: error`, and `no-restricted-syntax` with two selectors, `AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]` and `CallExpression[callee.object.name='document'][callee.property.name='write']`. For `src/engine/**/*.ts`: `no-restricted-imports` with one pattern group `['react','react-dom','react-dom/*','react-router','react-router/*','**/storage/**','**/sync/**','**/state/**','**/ui/**','**/features/**','**/app/**']`, and `no-restricted-globals` listing `window, document, navigator, localStorage, sessionStorage, indexedDB, fetch, XMLHttpRequest, WebSocket, location, history, alert`. Keep `languageOptions.globals` as `globals.browser`. Set `settings.react.version` to `'detect'`.
- [ ] **Step 4: Implement `.stylelintrc.json`** extending `stylelint-config-standard` with: `declaration-property-unit-disallowed-list` `{ "font-size": ["px"], "line-height": ["px"] }`; `color-no-hex` `true`; `selector-max-universal` `0`; `at-rule-disallowed-list` `["import"]`; `declaration-property-value-disallowed-list` `{ "outline": ["none", "0"] }`; and an override for `src/ui/tokens.css` setting `color-no-hex` to `null`.
- [ ] **Step 5: Run the tests and the full lint.** Run `pnpm test tools/guardrails.test.ts`, then `pnpm lint && pnpm lint:css`. Expected: 14 tests pass; both lint commands exit 0.
- [ ] **Step 6: Commit checkpoint.** Files: `eslint.config.js`, `.stylelintrc.json`, `tools/guardrails.test.ts`. Message:
  ```
  chore(config): add lint guardrails for the engine boundary and unsafe patterns

  - forbid ui, storage, sync, and dom access from `engine/` and block html string sinks
  - forbid px font sizes, hex colors outside tokens, universal selectors, `@import`, and `outline: none`
  - cover every rule with ESLint and Stylelint API tests
  ```

### Task 3: Domain primitives: Result, money, dates

**Files:**
- Create: `src/domain/result.ts`, `src/domain/money.ts`, `src/domain/dates.ts`
- Test: `src/domain/money.test.ts`, `src/domain/dates.test.ts`

**Interfaces:**
- Produces (`result.ts`): `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`, `ok<T>(value: T): Result<T, never>`, `err<E>(error: E): Result<never, E>`.
- Produces (`money.ts`): `type Centavos = number & { readonly __brand: 'Centavos' }`; `centavos(n: number): Centavos` (throws `RangeError` unless `Number.isSafeInteger(n)`); `type MoneyParseError = 'empty' | 'invalid' | 'negative' | 'too_many_decimals' | 'too_large'`; `parseMoney(input: string): Result<Centavos, MoneyParseError>`; `formatMoney(value: number): string` (throws `RangeError` for a non-integer).
- Produces (`dates.ts`): `initTemporal(): Promise<void>`; `temporal(): typeof Temporal` (throws `Error('Temporal not initialised')` before init); `parseIsoDate(s: string): Result<Temporal.PlainDate, 'invalid_date'>`; `parseIsoMonth(s: string): Result<Temporal.PlainYearMonth, 'invalid_month'>`; `isoDate(d: Temporal.PlainDate): string`; `isoMonth(m: Temporal.PlainYearMonth): string`; `monthOf(d: Temporal.PlainDate): Temporal.PlainYearMonth`; `addMonths(m: Temporal.PlainYearMonth, n: number): Temporal.PlainYearMonth`; `formatMonth(m: Temporal.PlainYearMonth): string` (for example `October 2026`). Types come from `import type { Temporal } from '@js-temporal/polyfill'`; at runtime use `globalThis.Temporal` when present (cast through `unknown`, because TypeScript's built-in `Temporal` type differs from the polyfill's) and otherwise `await import('@js-temporal/polyfill')`.

- [ ] **Step 1: Write the failing money tests** in `src/domain/money.test.ts`:
  - `parseMoney` accepts (value in centavos): `'1,200.50'` → 120050; `'1200'` → 120000; `'.5'` → 50; `'5.'` → 500; `'0'` → 0; `'₱ 1,200.00'` → 120000 (one leading peso sign and spaces allowed); `'  12.3  '` → 1230; `'1,000,000.00'` → 100000000.
  - It rejects: `''` and `'   '` → `empty`; `'abc'`, `'1.200,50'`, `'1,2,00'`, `'１２００'` (full-width digits), `'1e3'`, `'12..5'`, `'₱₱5'`, `'--5'` → `invalid`; `'-5'`, `'-0'`, `'−5'` (U+2212) → `negative`; `'12.345'` → `too_many_decimals`; `'99999999999999999999'` → `too_large`; the largest accepted value is `'90071992547409.91'` (centavos 9007199254740991) and `'90071992547409.92'` is `too_large`.
  - `formatMoney`: `0` → `'₱0.00'`; `120050` → `'₱1,200.50'`; `-50000` → `'−₱500.00'` (true minus U+2212, not hyphen); `1` → `'₱0.01'`; `-1` → `'−₱0.01'`; `100000000` → `'₱1,000,000.00'`; `formatMoney(1.5)` throws `RangeError`.
  - Round trip: for these amounts `parseMoney(formatMoney(n).replace('−', '-'))` is `negative` for negatives and equals `n` for positives (use `0, 1, 99, 100, 120050, 999999999`).
- [ ] **Step 2: Write the failing date tests** in `src/domain/dates.test.ts` (call `await initTemporal()` in `beforeAll`; also assert `temporal()` throws before init in a separate test file-level test run first): `parseIsoDate('2026-10-05')` is ok and `isoDate` of it is `'2026-10-05'`; `'2026-02-29'` is `invalid_date` (not a leap year); `'2028-02-29'` is ok; `'2026-13-01'`, `'2026-10-5'`, `'10/05/2026'`, `''` are `invalid_date`; `parseIsoMonth('2026-10')` ok, `'2026-00'` and `'2026-10-05'` are `invalid_month`; `addMonths(2026-12, 1)` is `2027-01`; `addMonths(2026-01, -1)` is `2025-12`; `addMonths(2026-10, 14)` is `2027-12`; `formatMonth(parseIsoMonth('2026-10'))` is `'October 2026'`; `monthOf(2026-10-31)` is `2026-10`.
- [ ] **Step 3: Run both to see them fail.** Run `pnpm test src/domain`. Expected: FAIL (modules not found).
- [ ] **Step 4: Implement `result.ts`.**
- [ ] **Step 5: Implement `parseMoney` in `money.ts`.** Approach: trim; strip one leading `₱`; trim again; classify with regular expressions against ASCII digits only; decide `negative` before `invalid`; reject comma grouping unless every group after the first has exactly 3 digits; split on the decimal point; compare the whole part as a `BigInt` against the limit before converting to a number. No `parseFloat`, no `Number()` on the full input.
- [ ] **Step 6: Implement `formatMoney`** with `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })` over `Math.abs(value) / 100`, prefixing `−` for negatives. Implement `centavos`. (Division by 100 is exact enough for display because the value is an integer below `2^53`; the formatter only formats, it never accumulates.)
- [ ] **Step 7: Implement `dates.ts`** as specified in the interfaces. `parseIsoDate` must use `overflow: 'reject'` so `2026-02-29` fails, and must reject any string that does not match `^\d{4}-\d{2}-\d{2}$` before calling Temporal.
- [ ] **Step 8: Run the tests.** Run `pnpm test src/domain && pnpm lint && pnpm typecheck`. Expected: all pass.
- [ ] **Step 9: Commit checkpoint.** Files: `src/domain/*`. Message:
  ```
  feat(core): add result type, money parsing and formatting, and temporal date helpers

  - parse and format money as integer centavos with string logic and a true minus sign
  - reject messy input such as full-width digits, european separators, exponents, and overflow
  - add Temporal helpers with a conditional polyfill for plain dates and year-months
  - cover accepted, rejected, boundary, and round-trip cases with Vitest
  ```

### Task 4: Preferences: theme and density, and the no-flash script

**Files:**
- Create: `src/ui/theme.ts`, `src/ui/density.ts`
- Modify: `index.html`
- Test: `src/ui/theme.test.ts`, `src/ui/density.test.ts`, `tests/e2e/theme-flash.spec.ts`

**Interfaces:**
- Produces (`theme.ts`): `type ThemePref = 'system' | 'light' | 'dark'`; `THEME_KEY = 'kaban:color-scheme'`; `readThemePref(storage: Pick<Storage, 'getItem'>): ThemePref` (anything other than `'light'` or `'dark'`, including a thrown error, yields `'system'`); `nextThemePref(current: ThemePref, systemIsDark: boolean): ThemePref` (from `'system'` pin the opposite of the system; from any pinned value return to `'system'`); `colorSchemeContent(pref: ThemePref): 'light dark' | 'light' | 'dark'`; `applyThemePref(pref: ThemePref, doc: Document, storage: Pick<Storage, 'setItem' | 'removeItem'>): void` (updates the `<meta name="color-scheme">` content and persists; `'system'` removes the key; storage errors are swallowed).
- Produces (`density.ts`): `type Density = 'compact' | 'comfortable'`; `DENSITY_KEY = 'kaban:density'`; `readDensity(storage: Pick<Storage, 'getItem'>): Density` (default `'compact'`); `applyDensity(d: Density, doc: Document, storage: Pick<Storage, 'setItem'>): void` (sets `data-density` on `<html>` and persists).

- [ ] **Step 1: Write the failing unit tests.** Theme: `readThemePref` returns the stored value for `'light'` and `'dark'`; returns `'system'` for `null`, `''`, `'blue'`, `'LIGHT'`, `'{"a":1}'`, and when `getItem` throws. `nextThemePref('system', true)` is `'light'`; `nextThemePref('system', false)` is `'dark'`; `nextThemePref('dark', false)` is `'system'`; `nextThemePref('light', true)` is `'system'`. A pinned choice stays pinned when the system flips: simulate `p = nextThemePref('system', false)` then confirm `colorSchemeContent(p)` is `'dark'` regardless of any later system value. `colorSchemeContent` maps `'system'` to `'light dark'`. Density: `readDensity` returns `'comfortable'` only for the exact string `'comfortable'`, else `'compact'`, including on a throwing storage.
- [ ] **Step 2: Write the failing e2e test** `tests/e2e/theme-flash.spec.ts` (needs the Playwright config from Task 6, so mark this step as done when Task 6 exists, and run it there; write the file now): with `localStorage` seeded before navigation using `page.addInitScript` and system color scheme emulated as `light`, loading `/` gives `document.querySelector('meta[name="color-scheme"]').content === 'dark'` at `domcontentloaded`; with the stored value `'blue'` the content is `'light dark'`; with no stored value it is `'light dark'`.
- [ ] **Step 3: Run the unit tests to see them fail.** Run `pnpm test src/ui`. Expected: FAIL.
- [ ] **Step 4: Implement** `theme.ts` and `density.ts` as specified.
- [ ] **Step 5: Add the inline script to `index.html`** as the first element in `<head>` after the color-scheme meta, exactly:
  ```html
  <script>{try{const v=localStorage.getItem('kaban:color-scheme');if(v==='light'||v==='dark')document.querySelector('meta[name="color-scheme"]').content=v}catch{}}</script>
  ```
  It must be a classic script (not a module, not deferred). The stored key and the accepted values must match `THEME_KEY` and `readThemePref`.
- [ ] **Step 6: Run the unit tests.** Run `pnpm test src/ui && pnpm lint && pnpm typecheck`. Expected: PASS.
- [ ] **Step 7: Commit checkpoint.** Files: `src/ui/theme.ts`, `src/ui/density.ts`, their tests, `tests/e2e/theme-flash.spec.ts`, `index.html`. Message:
  ```
  feat(theme): add two-state theme and density preferences with a no-flash script

  - read, toggle, and apply the color scheme with junk values falling back to system
  - add compact and comfortable density preference helpers
  - set the stored color scheme from an inline classic script before first paint
  - cover valid, corrupt, and throwing storage cases with Vitest
  ```

### Task 5: Layers, tokens, base styles, fonts

**Files:**
- Create: `src/ui/tokens.css`, `src/ui/base.css`
- Modify: `src/ui/layers.css`, `src/main.tsx`
- Test: `tests/e2e/tokens.spec.ts`

**Interfaces:**
- Produces (custom properties on `:root`):
  - Colors (each a `light-dark()` of two raw tokens, with the `prefers-color-scheme` fallback from the guidance doc): `--bg`, `--surface`, `--surface-header`, `--surface-selected`, `--control`, `--track`, `--ink`, `--ink-2`, `--signal`, `--on-signal` (`#FFFFFF`), `--highlight-bg` (dark `#FFFFFF`, light `#000000`), `--highlight-ink` (dark `#000000`, light `#FFFFFF`), `--line` (dark `#1C1C1C`, light `#E4E4E4`), `--warn-bg` (dark `#1A0A0D`, light `#FFF1F2`), `--warn-border` (dark `#5B1621`, light `#F0B4BC`). Values for the first nine come from spec section 6.2.
  - Type: `--font-serif: "Nothing Serif", "Newsreader Variable", Georgia, serif`; `--font-sans: "Geist Variable", system-ui, sans-serif`; `--fs-caption: 0.6875rem`; `--fs-body` (`0.8125rem` compact, `0.875rem` comfortable and phone); `--fs-title: 1.375rem`; `--fs-display-sm: 1.125rem`; `--fs-display-phone: 1.875rem`.
  - Space and shape: `--space-1: 0.25rem`, `--space-2: 0.5rem`, `--space-3: 0.75rem`, `--space-4: 1rem`, `--space-6: 1.5rem`, `--space-8: 2rem`; `--radius-pill: 999px`.
  - Density tokens set by `:root[data-density="compact"]` (also the default when the attribute is absent), `:root[data-density="comfortable"]`, and a phone override inside `@media (max-width: 760px)`: `--row-h` (36px, 52px, 56px), `--card-radius` (10px, 18px, 14px), `--card-gap` (8px, 12px, 10px), `--bar-h` (2px, 4px, 4px), `--icon-bubble` (`none`, `flex`, `flex`). These pixel values are allowed because they are in `tokens.css`; the lint rule only restricts font sizes.
  - Motion and focus: `--dur-fast: 120ms`, `--dur: 180ms`, `--ease: ease-out`, `--focus-ring: 2px solid var(--ink)`, `--focus-offset: 2px`.
- Produces: a `.visually-hidden` utility in `base.css` using the recipe from the guidance doc (section 5).

- [ ] **Step 1: Write the failing e2e test** `tests/e2e/tokens.spec.ts` against the dev server (after Task 6's config exists; write now): color tokens are checked through a real element, because an unregistered custom property reports its `light-dark()` source text, not the resolved color. Add a helper that appends a `<div>`, sets `style.backgroundColor = 'var(--surface)'`, and reads `getComputedStyle(div).backgroundColor`. With `colorScheme: 'dark'` emulated, `--surface` resolves to `rgb(19, 19, 19)` and `--ink-2` to `rgb(143, 143, 143)`; with `colorScheme: 'light'`, `--bg` resolves to `rgb(242, 242, 242)` and `--ink-2` to `rgb(107, 107, 107)`. Density tokens are plain values and can be read with `getPropertyValue(...).trim()`. With `data-density="comfortable"` set on `<html>`, `--row-h` is `52px`; at viewport width 390, `--row-h` is `56px`. The document font family of `body` includes `Geist Variable`. The computed `color-scheme` of `<html>` is `light dark`.
- [ ] **Step 2: Run it to see it fail** after Task 6's Playwright config exists. Expected: FAIL (tokens undefined).
- [ ] **Step 3: Implement the CSS.** `layers.css` holds only the `@layer` order statement and is imported first in `main.tsx`. `tokens.css` declares everything above inside `@layer tokens`, sets `color-scheme: light dark` on `:root`, and defines each color once as `light-dark(var(--x-light), var(--x-dark))` over raw tokens, with a `prefers-color-scheme: dark` fallback block. `base.css` (in `@layer reset` and `@layer base`) resets only specific elements (`body` margin, `button` and `input` font inheritance, `h1` to `h6` margins), sets `body` to `background: var(--bg); color: var(--ink); font: var(--fs-body)/1.5 var(--font-sans)`, `font-variant-numeric: tabular-nums` on `body`, `:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset) }`, `text-wrap: balance` on `h1, h2, h3`, `accent-color: var(--ink)`, `scrollbar-color` from tokens, and a `@media (prefers-reduced-motion: reduce)` block that sets `--dur` and `--dur-fast` to `0ms`.
- [ ] **Step 4: Wire fonts and polyfills in `main.tsx`.** Import in this order: `./ui/layers.css`, `./ui/tokens.css`, `./ui/base.css`, `@fontsource-variable/geist/wght.css`, `@fontsource-variable/newsreader/opsz.css`. Add `@font-face` for `"Nothing Serif"` in `base.css` pointing at `/fonts/nothing-serif.woff2` with `font-display: swap` (the file is supplied later by the owner; a missing file must fall back silently to Newsreader). Before mounting, `if (!('popover' in HTMLElement.prototype)) await import('@oddbird/popover-polyfill')` and `await initTemporal()`. Apply stored density with `applyDensity(readDensity(localStorage), document, localStorage)` before mount.
- [ ] **Step 5: Verify** with `pnpm verify` and, once Task 6 exists, `pnpm test:e2e tests/e2e/tokens.spec.ts`. Expected: PASS.
- [ ] **Step 6: Commit checkpoint.** Files: `src/ui/layers.css`, `tokens.css`, `base.css`, `src/main.tsx`, `tests/e2e/tokens.spec.ts`. Message:
  ```
  feat(design-system): add layers, tokens, base styles, and self-hosted fonts

  - define light-dark color tokens from the spec with measured contrast values
  - add density tokens for compact, comfortable, and phone sizes
  - self-host Geist and Newsreader and prepare a Nothing Serif face with a silent fallback
  - add focus, reduced-motion, and visually-hidden base rules
  ```

### Task 6: Display components, the gallery, and the Playwright setup

**Files:**
- Create: `playwright.config.ts`, `src/ui/components/{Button,Chip,Card,Amount,StatusPill,ProgressBar,VisuallyHidden}.tsx` and a `.css` file beside each that needs styles, `src/features/gallery/Gallery.tsx`
- Test: `tests/e2e/gallery.spec.ts`

**Interfaces:**
- Consumes: `formatMoney`, `Centavos` (Task 3); tokens (Task 5).
- Produces:
  - `Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' })`: default `type="button"`; primary uses `--highlight-bg` and `--highlight-ink`; secondary uses `--control`; pill radius; minimum block size 1.5rem, and 2.75rem on `pointer: coarse`.
  - `Chip(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean })`: renders `aria-pressed`.
  - `Card(props: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' | 'li' })`: uses `--surface` and `--card-radius`.
  - `Amount(props: { centavos: number; className?: string })`: a `<span>` showing `formatMoney`.
  - `type StatusKind = 'funded' | 'underfunded' | 'overspent' | 'zero'`; `StatusPill(props: { kind: StatusKind; centavos: number })`: `funded` is a `--control` pill with the amount; `underfunded` is a 1px `--ink-2` outlined pill with the amount; `overspent` is a `--signal` pill with `--on-signal` text, an inline SVG triangle (`aria-hidden`) and the amount, plus `VisuallyHidden` text `Overspent by ₱500.00` (the absolute amount); `zero` is plain `--ink-2` text.
  - `ProgressBar(props: { value: number; max: number; tone?: 'normal' | 'danger'; label: string })`: native `<progress>` with `aria-label`, value clamped to `[0, max]`, thickness `--bar-h`, fill `--ink` or `--signal`.
  - `VisuallyHidden(props: { children: React.ReactNode })`.
  - Icons come from `lucide-react` with `strokeWidth={1.5}` and `aria-hidden`.
- Produces: the route `/dev/gallery` (registered only when `import.meta.env.DEV`) rendering every component in every state.

- [ ] **Step 1: Create `playwright.config.ts`** with `testDir: 'tests/e2e'`. Two projects: `dev` (`testMatch: /^(?!.*preview).*\.spec\.ts$/`, base URL `http://localhost:5173`, web server `pnpm dev`, `reuseExistingServer: true`) and `preview` (`testMatch: /.*\.preview\.spec\.ts/`, base URL `http://localhost:4173`, web server `pnpm build && pnpm preview --port 4173 --strictPort`). Use Chromium only. Run `pnpm exec playwright install chromium` once.
- [ ] **Step 2: Write the failing gallery test** `tests/e2e/gallery.spec.ts` (project `dev`, route `/dev/gallery`; router lands in Task 9, so for now mount the gallery from `main.tsx` when the path is `/dev/gallery` and move it into the router in Task 9):
  - `Button`: `getByRole('button', { name: 'Assign' })` is visible; tabbing to it gives a focus outline whose `outline-style` is not `none`; its computed height is at least 24px.
  - `StatusPill`: for `overspent` with `-50000`, the text `Overspent by ₱500.00` exists (visually hidden) and the visible text includes `−₱500.00`; for `underfunded` the pill has a 1px border; for `zero` no background color.
  - `ProgressBar`: `getByRole('progressbar', { name: 'Groceries funded' })` exists; `value` over `max` is clamped (render `value=150 max=100`, the element's `value` property is `100`).
  - `Chip`: pressing it toggles `aria-pressed` between `true` and `false`.
  - **axe** `new AxeBuilder({ page }).analyze()` returns zero violations with `colorScheme: 'dark'` and with `colorScheme: 'light'`.
  - Contrast guard: in light mode the computed color of `.ink-2` sample text over its background must be at least 4.5:1 (compute with a small in-test helper using the two resolved colors).
- [ ] **Step 3: Run it to see it fail.** Run `pnpm test:e2e tests/e2e/gallery.spec.ts --project=dev`. Expected: FAIL (route not found or components missing).
- [ ] **Step 4: Implement the components and the gallery.** Component CSS goes in `@layer components` files beside each component and uses only tokens. `Gallery` renders each component in all states inside a `<main>` with one `<h1>`.
- [ ] **Step 5: Run the test.** Expected: PASS. Then run `pnpm verify`.
- [ ] **Step 6: Commit checkpoint.** Files: `playwright.config.ts`, `src/ui/components/*`, `src/features/gallery/Gallery.tsx`, `src/main.tsx`, `tests/e2e/gallery.spec.ts`. Message:
  ```
  feat(ui): add button, chip, card, amount, status pill, and progress bar

  - build components on tokens with measured contrast and accessible names
  - draw the overspent marker as an inline svg and announce the overspent amount
  - add a dev-only component gallery and Playwright axe checks in light and dark
  ```

### Task 7: Overlays: sheet and toasts

**Files:**
- Create: `src/ui/components/Sheet.tsx`, `Sheet.css`, `src/ui/components/toast.ts`, `ToastRegion.tsx`, `Toast.css`
- Modify: `src/features/gallery/Gallery.tsx`
- Test: `src/ui/components/toast.test.ts`, `tests/e2e/overlays.spec.ts`

**Interfaces:**
- Consumes: tokens, `Button` (Task 6).
- Produces (`toast.ts`, framework-free):
  ```ts
  export interface ToastAction { label: string; onAction: () => void }
  export interface ToastOptions { kind?: 'info' | 'success' | 'error'; action?: ToastAction; persistent?: boolean; durationMs?: number }
  export interface ToastItem { id: string; message: string; kind: 'info' | 'success' | 'error'; action?: ToastAction; persistent: boolean }
  export function showToast(message: string, options?: ToastOptions): string
  export function dismissToast(id: string): void
  export function subscribeToasts(listener: (items: readonly ToastItem[]) => void): () => void
  ```
  Defaults: `kind 'info'`, `durationMs 3000`, `persistent` false except `kind 'error'` and any toast with an `action` (both persistent by default). The listener is called immediately with the current list and on every change.
- Produces: `Sheet(props: { open: boolean; onClose: () => void; title: string; children: React.ReactNode })`: renders a native `<dialog aria-labelledby>`; calls `showModal()` when `open` becomes true and `close()` when false; the dialog's `close` event calls `onClose`; a visible close button named `Close`; slides up on narrow viewports and centers on wide ones with `@starting-style`, `transition-behavior: allow-discrete` and `overlay`, with a reduced-motion version.
- Produces: `ToastRegion()`: mounted once; renders one visually hidden `role="status" aria-live="polite"` region for announcements and a stack of `popover="manual"` toasts (each shown with `showPopover()`), each with a `Dismiss` button; action toasts render the action as a `Button`.

- [ ] **Step 1: Write the failing store tests** `src/ui/components/toast.test.ts` with Vitest fake timers: `showToast('Saved')` returns a non-empty id and the listener sees one item; after 3000 ms it is removed; `showToast('Oops', { kind: 'error' })` is still present after 60 seconds; `showToast('Update ready', { action })` is persistent; `dismissToast(id)` removes immediately; dismissing an unknown id is a no-op; ten rapid `showToast` calls produce ten distinct ids and ten items in call order; `durationMs: 500` removes after 500 ms; unsubscribing stops notifications.
- [ ] **Step 2: Write the failing e2e test** `tests/e2e/overlays.spec.ts` (gallery route): opening the sheet with the `Open sheet` button shows `getByRole('dialog', { name: 'New transaction' })`; elements behind it are not focusable by Tab (after tabbing 10 times, focus is still inside the dialog); pressing Escape closes it and `document.activeElement` is the `Open sheet` button (Review Focus 3); the close button also closes it; opening and closing three times in a row works. Toasts: clicking `Show 3 toasts` makes the polite live region contain each message exactly once (poll its text), three toasts are visible without overlapping (their bounding boxes do not intersect), and they disappear after about 3 seconds; clicking `Show update toast` shows an action toast that is still present after 5 seconds until its `Dismiss` is clicked (Review Focus 4). axe has no violations with the sheet open, in both color schemes.
- [ ] **Step 3: Run both to see them fail.** Run `pnpm test src/ui/components` and `pnpm test:e2e tests/e2e/overlays.spec.ts --project=dev`. Expected: FAIL.
- [ ] **Step 4: Implement** `toast.ts` (a module-level array plus listeners plus `setTimeout` per non-persistent toast, ids from an incrementing counter), `ToastRegion.tsx`, `Sheet.tsx` and the CSS. `Sheet` must not add its own focus trap or `inert` handling; the native dialog provides both.
- [ ] **Step 5: Extend the gallery** with the buttons named in the tests (`Open sheet`, `Show 3 toasts`, `Show update toast`) and mount `ToastRegion` once.
- [ ] **Step 6: Run the tests and `pnpm verify`.** Expected: PASS.
- [ ] **Step 7: Commit checkpoint.** Files: the new components, gallery changes, tests. Message:
  ```
  feat(ui): add native dialog sheet and popover toast system

  - build the sheet on the native dialog with animated entry and a visible close button
  - add a framework-free toast store with auto-dismiss, persistent errors, and action toasts
  - announce toasts through one polite live region and stack them as manual popovers
  - cover focus return, inertness, announcements, and stacking with tests
  ```

### Task 8: Forms: Field and MoneyInput

**Files:**
- Create: `src/ui/components/Field.tsx`, `Field.css`, `MoneyInput.tsx`, `moneyField.ts`
- Modify: `src/features/gallery/Gallery.tsx`
- Test: `src/ui/components/moneyField.test.ts`, `tests/e2e/forms.spec.ts`

**Interfaces:**
- Consumes: `parseMoney`, `MoneyParseError`, `Centavos` (Task 3).
- Produces (`moneyField.ts`):
  ```ts
  export interface MoneyFieldState { text: string; centavos: Centavos | null; error: MoneyParseError | null }
  export type MoneyFieldEvent = { type: 'input'; text: string } | { type: 'blur' }
  export function initialMoneyField(text?: string): MoneyFieldState
  export function reduceMoneyField(state: MoneyFieldState, event: MoneyFieldEvent, required: boolean): MoneyFieldState
  export const moneyErrorMessage: Record<MoneyParseError, string>
  export function shouldSubmitOnEnter(e: { key: string; isComposing: boolean; shiftKey?: boolean }): boolean
  ```
  Behavior: `input` updates `text`, clears `error`, and sets `centavos` to the parsed value or `null` (never sets an error); `blur` validates: empty text with `required` false gives `error: null` and `centavos: null`; empty with `required` true gives `'empty'`; otherwise the `parseMoney` error or value. `moneyErrorMessage` copy (exact): `empty` "Enter an amount.", `invalid` "Use numbers like 1,200.50.", `negative` "Enter an amount above zero.", `too_many_decimals` "Use at most two decimal places.", `too_large` "That amount is too large.". `shouldSubmitOnEnter` is true only for `key === 'Enter'`, `isComposing === false`, and no `shiftKey`.
- Produces: `Field(props: { label: string; hint?: string; error?: string | null; children: (control: { id: string; 'aria-describedby': string | undefined; 'aria-invalid': true | undefined }) => React.ReactNode })`: the label is above the control and tied with `for`/`id`; the hint and error ids are joined in `aria-describedby`; the error is in a polite live region with an icon plus text (never color alone).
- Produces: `MoneyInput(props: { label: string; value: Centavos | null; onChange: (c: Centavos | null) => void; required?: boolean; hint?: string; name?: string })`: `<input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done">`, font size at least `1rem`, block size 3rem on `pointer: coarse`.

- [ ] **Step 1: Write the failing unit tests** for `reduceMoneyField` and `shouldSubmitOnEnter`: typing `'12,00.5x'` produces no error and `centavos: null`; blur after that gives `invalid`; typing then correcting to `'1,200.50'` clears the error on the next input and blur gives 120050; blur on empty with `required` false is clean; blur on empty with `required` true is `empty`; `'-5'` blur is `negative`; the message table has an entry for every `MoneyParseError`; `shouldSubmitOnEnter({ key: 'Enter', isComposing: true })` is false, `{ key: 'Enter', isComposing: false }` true, `{ key: 'Enter', isComposing: false, shiftKey: true }` false, `{ key: 'a', isComposing: false }` false.
- [ ] **Step 2: Write the failing e2e test** `tests/e2e/forms.spec.ts` (gallery): the field is found by `getByLabel('Amount')`; typing `1,200.5x` shows no error text while typing; after blur the text `Use numbers like 1,200.50.` is visible, `aria-invalid` is `true`, and `aria-describedby` references an element containing that text; typing a valid amount and blurring clears it; the input's computed font size is at least 16px at a 390px viewport and its height at least 48px with `pointer: coarse` (use `page.emulateMedia` is not available for pointer, so assert the CSS rule by reading the stylesheet rule text for `@media (pointer: coarse)`); axe has no violations in both color schemes.
- [ ] **Step 3: Run to see failures.** Run `pnpm test src/ui/components/moneyField.test.ts` and the e2e test. Expected: FAIL.
- [ ] **Step 4: Implement** the reducer and components. `MoneyInput` keeps a `useReducer` over `reduceMoneyField`, calls `onChange` with the new `centavos` on every input event, and never calls `parseFloat`.
- [ ] **Step 5: Add them to the gallery** (an `Amount` field and a `Payee` text field) and run the tests and `pnpm verify`. Expected: PASS.
- [ ] **Step 6: Commit checkpoint.** Files: the new components, tests, gallery. Message:
  ```
  feat(ui): add labeled field and money input with blur-time validation

  - add a field wrapper with label above, hint, and announced error text with an icon
  - add a decimal text money input that parses to centavos and validates on blur
  - guard enter-to-submit against ime composition
  - cover typing, blur, correction, copy, and mobile sizing with tests
  ```

### Task 9: App shell, routes, and placeholder screens

**Files:**
- Create: `src/app/nav.ts`, `src/app/App.tsx`, `src/app/Shell.tsx`, `src/app/shell.css`, `src/app/useRouteAnnouncer.ts`, `src/app/RootRedirect.tsx`, `src/features/placeholder/PlaceholderScreen.tsx`, `src/features/{home,plan,spending,accounts,reflect,settings}/*Screen.tsx`
- Modify: `src/main.tsx`
- Test: `src/app/nav.test.ts`, `tests/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: components (Tasks 6 to 8), `applyThemePref`, `readThemePref`, `nextThemePref`, `applyDensity` (Task 4).
- Produces (`nav.ts`): 
  ```ts
  export interface NavItem { path: string; label: string; phoneLabel?: string; icon: LucideIcon; laptop: boolean; phone: boolean }
  export const NAV_ITEMS: readonly NavItem[]
  export function titleFor(pathname: string): string
  ```
  `NAV_ITEMS` in order: `/home` (Home, phone only), `/plan` (Plan, both), `/spending` (Spending, both), `/accounts` (label `All accounts`, phoneLabel `Accounts`, both), `/reflect` (Reflect, both), `/settings` (Settings, laptop only; reachable on phone from the Home screen header). `titleFor('/plan')` is `'Plan | Kaban'`; an unknown path gives `'Not found | Kaban'`; `/` gives `'Kaban'`.
- Produces: routes for each path; `/` renders `RootRedirect`, which navigates with `replace` to `/home` when `matchMedia('(max-width: 760px)').matches` and to `/plan` otherwise; `*` renders a "Not found" screen with a link home; `/dev/gallery` is registered only in dev.
- Produces: `Shell` with these landmarks: a skip link `Skip to content` targeting `<main id="content" tabindex="-1">`; `<nav aria-label="Main">` (sidebar on wide screens, icon rail on tablet, hidden on phone); `<nav aria-label="Tabs">` (phone only, five tabs); `<aside aria-label="Inspector">` (wide screens only; tablet and phone have no persistent inspector yet); an extended `Transaction` button on phone (hidden on `/reflect`) that opens a `Sheet` titled `New transaction` containing the text "Adding transactions arrives in plan 2."; a ToastRegion.
- Produces: shell layout switches with viewport media queries only: wide at `min-width: 1100px` (sidebar 220px, inspector 380px), tablet 761 to 1099px (rail 64px), phone at `max-width: 760px`.
- Produces (`useRouteAnnouncer`): on every route change, sets `document.title` from `titleFor` and moves focus to the first `h1` inside `<main>` (the heading gets `tabindex="-1"`).
- Produces: `PlaceholderScreen(props: { title: string; builtIn: string })` renders an `h1` and the text `Built in {builtIn}.`; screens: Home (Plan 3), Plan (Plan 2), Spending (Plan 2), Accounts (Plan 2), Reflect (Plan 6), Settings (this plan: the two preference controls below).
- Produces: the Settings screen with a two-state theme button whose accessible name is `Use dark theme` or `Use light theme` or `Use system theme` according to `nextThemePref` (describing the action, never the state), and a density radio group (`Compact`, `Comfortable`).

- [ ] **Step 1: Write the failing unit tests** `src/app/nav.test.ts`: the order and flags of `NAV_ITEMS` as above; every path in `NAV_ITEMS` has a distinct `titleFor`; unknown path and `/` cases.
- [ ] **Step 2: Write the failing e2e tests** `tests/e2e/shell.spec.ts`:
  - At 1440 by 900: `getByRole('navigation', { name: 'Main' })` has links `Plan`, `Spending`, `All accounts`, `Reflect`, `Settings` and no `Home`; `getByRole('complementary', { name: 'Inspector' })` is visible; no `Tabs` navigation; loading `/` ends at `/plan`.
  - At 820 by 1024: the main navigation is visible as a rail (each link keeps its accessible name); the inspector is not visible; no tabs.
  - At 390 by 844: `getByRole('navigation', { name: 'Tabs' })` has exactly the links `Home`, `Plan`, `Spending`, `Accounts`, `Reflect`; the main navigation is not visible; loading `/` ends at `/home`; the `Transaction` button is visible on `/plan` and not visible on `/reflect`; clicking it opens the `New transaction` dialog.
  - Skip link: pressing Tab once focuses `Skip to content`; pressing Enter moves focus to `main` (`#content`) (Review Focus 5).
  - Route change: navigating to Spending sets `document.title` to `Spending | Kaban` and `document.activeElement` is the `h1` with text `Spending` (Review Focus 5).
  - Not found: `/nope` shows `Not found` with a working link home and `Not found | Kaban` as the title.
  - Settings: the theme button toggles the `<meta name="color-scheme">` content between `light dark` and a pinned value, and the choice survives a reload; the density radios set `data-density` on `<html>` and survive a reload; corrupt stored values (seeded via `addInitScript`) still render the page.
  - axe has no violations on `/plan`, `/settings` and the 404 at all three viewport sizes, in both color schemes.
- [ ] **Step 3: Run to see failures.** Run `pnpm test src/app` and `pnpm test:e2e tests/e2e/shell.spec.ts --project=dev`. Expected: FAIL.
- [ ] **Step 4: Implement** the model, shell, routes and screens. Add the router with `BrowserRouter`, `Routes` and `Route` from `react-router`. Move the gallery route into the router (dev only) and remove the temporary mount from Task 6. Layout CSS lives in `shell.css` in `@layer components` and uses grid areas; the shell uses viewport media queries, anything inside content uses container queries.
- [ ] **Step 5: Run all tests.** Run `pnpm verify:e2e`. Expected: everything passes.
- [ ] **Step 6: Commit checkpoint.** Files: everything under `src/app`, `src/features`, `src/main.tsx`, tests. Message:
  ```
  feat(shell): add responsive app shell with routes and placeholder screens

  - add laptop sidebar with inspector, tablet icon rail, and phone tab bar with add button
  - add skip link, route titles, and focus-to-heading on navigation
  - add settings with a two-state theme control and a density selector
  - cover layouts at three widths, keyboard flow, corrupt preferences, and axe checks
  ```

### Task 10: PWA: manifest, icons, offline shell, update prompt, persistence

**Files:**
- Create: `public/icon.svg`, `scripts/make-icons.ts`, `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `src/app/pwa.ts`, `src/app/storage-persist.ts`
- Modify: `vite.config.ts`, `src/main.tsx`, `package.json` (script `icons`)
- Test: `src/app/storage-persist.test.ts`, `scripts/make-icons.test.ts`, `tests/e2e/pwa.preview.spec.ts`

**Interfaces:**
- Consumes: `showToast` (Task 7).
- Produces (`storage-persist.ts`): `requestPersistence(storage?: Pick<StorageManager, 'persist' | 'persisted'> | undefined): Promise<'granted' | 'denied' | 'unsupported'>`: `unsupported` when `storage` is undefined or has no `persist`; `granted` immediately when `persisted()` is already true; otherwise the result of `persist()`; any thrown error gives `denied`.
- Produces (`pwa.ts`): `registerPwa(): void` using `registerSW` from `virtual:pwa-register`: `onNeedRefresh` calls `showToast('A new version is ready.', { action: { label: 'Reload', onAction: () => updateSW(true) } })` (persistent); `onOfflineReady` calls `showToast('Kaban works offline now.')`.
- Produces: `public/icon.svg` exactly `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#000000"/><circle cx="256" cy="256" r="120" fill="none" stroke="#FFFFFF" stroke-width="28"/><circle cx="352" cy="160" r="28" fill="#C8102E"/></svg>`.
- Produces (`scripts/make-icons.ts`): renders the SVG with `sharp` to `icon-192.png` (192), `icon-512.png` (512) and `maskable-512.png` (512, with the mark scaled to 60% on the black background for the maskable safe zone).

- [ ] **Step 1: Write the failing unit tests.** `storage-persist.test.ts` with fake storage objects: `undefined` → `unsupported`; object without `persist` → `unsupported`; `persisted()` true → `granted` and `persist` not called; `persisted()` false and `persist()` true → `granted`; `persist()` false → `denied`; `persist()` throws → `denied`. `make-icons.test.ts`: after running the script's exported `makeIcons(): Promise<void>` into a temporary directory, the three files exist and `sharp(file).metadata()` reports 192 by 192, 512 by 512, 512 by 512.
- [ ] **Step 2: Write the failing preview e2e test** `tests/e2e/pwa.preview.spec.ts` (project `preview`): `GET /manifest.webmanifest` has `name` `Kaban`, `short_name` `Kaban`, `display` `standalone`, `start_url` `/`, `theme_color` and `background_color` `#000000`, and icons of 192 and 512 plus a `maskable` icon; after load, `await navigator.serviceWorker.ready` resolves; after the worker is active, `context.setOffline(true)` and reloading `/plan` still renders the `Plan` heading (offline first load after install); a deep link `/spending` works offline too; `localStorage` preferences still apply offline; the page registers no request to any origin other than `localhost` (collect `page.on('request')`).
- [ ] **Step 3: Run them to see failures.** Run `pnpm test src/app/storage-persist.test.ts scripts/make-icons.test.ts` and `pnpm test:e2e tests/e2e/pwa.preview.spec.ts --project=preview`. Expected: FAIL.
- [ ] **Step 4: Implement.** Add `VitePWA` to `vite.config.ts` with `registerType: 'prompt'`, the manifest above (also `description: 'A private budgeting app that works offline.'`, `scope: '/'`, `categories: ['finance']`), icons pointing at `/icons/*.png`, and `workbox.globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}']` with `navigateFallback: '/index.html'`. Precache everything; do not add runtime caching routes. Implement the helpers. In `main.tsx`, after mount, call `registerPwa()` and `requestPersistence(navigator.storage)`. Add `"icons": "node scripts/make-icons.ts"` to `package.json` scripts, run it once, and keep the three PNGs.
- [ ] **Step 5: Run the tests.** Expected: PASS. Run `pnpm verify`.
- [ ] **Step 6: Commit checkpoint.** Files: as listed plus `public/icons/*`. Message:
  ```
  feat(pwa): add manifest, icons, offline shell, update prompt, and storage persistence

  - precache the app shell with a prompt-to-reload update toast
  - generate 192, 512, and maskable icons from one svg with sharp
  - request persistent storage on startup and report granted, denied, or unsupported
  - cover offline first load, deep links, manifest fields, and no third-party requests
  ```

### Task 11: Security headers with hashed inline script

**Files:**
- Create: `config/headers.template`, `scripts/csp.ts`, `scripts/write-headers.ts`
- Modify: `package.json` (`build` script)
- Test: `scripts/csp.test.ts`, `tests/e2e/headers.preview.spec.ts` (static check only)

**Interfaces:**
- Produces (`csp.ts`): `inlineScriptHashes(html: string): string[]` returns one `'sha256-<base64>'` (single-quoted) per classic inline `<script>` that has no `src` and is not `type="module"`, hashing the exact text between the tags; `renderHeaders(template: string, hashes: string[]): string` replaces `{{SCRIPT_HASHES}}` with the hashes joined by spaces (empty string when none).
- Produces: `config/headers.template` with this content (Cloudflare Pages `_headers` format):
  ```
  /*
    Content-Security-Policy: frame-ancestors 'self'
    Content-Security-Policy-Report-Only: script-src 'self' {{SCRIPT_HASHES}} 'wasm-unsafe-eval'; base-uri 'none'; object-src 'none'
    X-Frame-Options: SAMEORIGIN
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
    Strict-Transport-Security: max-age=300
  /assets/*
    Cache-Control: public, max-age=31536000, immutable
  /index.html
    Cache-Control: no-cache
  /sw.js
    Cache-Control: no-cache
  ```
- Produces: `scripts/write-headers.ts` reads `dist/index.html` and `config/headers.template` and writes `dist/_headers`. The `build` script becomes `tsc --noEmit && vite build && node scripts/write-headers.ts`.

- [ ] **Step 1: Read the Plan 0 decision record.** Open `docs/decisions/0001-storage-and-sync.md`. If it says cross-origin isolation headers are required, add `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to the `/*` block of the template and note it in the commit message. If the record does not exist yet, stop and tell the owner that Plan 0 must finish first.
- [ ] **Step 2: Write the failing unit tests** `scripts/csp.test.ts`: html with one inline classic script yields one hash equal to the known SHA-256 base64 of its exact text (compute the expected value in the test with `node:crypto`); two inline scripts yield two hashes in document order; `<script type="module" src="/a.js">` and `<script src="x.js">` yield none; an inline `type="module"` script yields none; whitespace inside the tag text is significant (a trailing space changes the hash); `renderHeaders` replaces the placeholder with space-joined hashes and with an empty string for none, leaving no `{{` in the output; the real `config/headers.template` contains `{{SCRIPT_HASHES}}` exactly once.
- [ ] **Step 3: Write the failing e2e test** `tests/e2e/headers.preview.spec.ts` (project `preview`): after `pnpm build`, the file `dist/_headers` exists, contains no `{{`, and its report-only policy contains a `'sha256-` hash that equals the hash of the inline theme script in `dist/index.html`.
- [ ] **Step 4: Run to see failures.** Run `pnpm test scripts/csp.test.ts` and the preview test. Expected: FAIL.
- [ ] **Step 5: Implement** `csp.ts` (regex or a small tag scan; `node:crypto` for hashing) and `write-headers.ts`.
- [ ] **Step 6: Run the tests and `pnpm verify`.** Expected: PASS and `dist/_headers` present.
- [ ] **Step 7: Commit checkpoint.** Files: `config/headers.template`, `scripts/csp.ts`, `scripts/write-headers.ts`, `scripts/csp.test.ts`, `tests/e2e/headers.preview.spec.ts`, `package.json`. Message:
  ```
  feat(security): generate hash-based csp report-only headers at build time

  - hash the inline theme script and write it into the report-only script policy
  - add enforced frame-ancestors, nosniff, referrer, permissions, and short-lived hsts headers
  - set immutable caching for hashed assets and no-cache for the shell and service worker
  - cover hashing, template rendering, and the built headers file
  ```

### Task 12: Agent instructions and handoff template

**Files:**
- Create: `AGENTS.md`, `.cursor/rules/kaban.mdc`, `docs/templates/HANDOFF.md`
- Test: `tools/agents.test.ts`

**Interfaces:**
- Produces: `AGENTS.md` with these sections, in order: `Project`, `Commands`, `Pinned versions` (a table of `name | version` for every dependency in `package.json`), `Folder boundaries`, `Hard rules`, `Commits`, `Definition of done`, `Reading list`.
- Content decisions: `Commands` lists `pnpm dev`, `pnpm verify`, `pnpm verify:e2e`, `pnpm test <file>`, `pnpm test:e2e <file> --project=dev|preview`. `Hard rules` states: money is integer centavos with `parseMoney` and `formatMoney` only; dates use Temporal helpers; tokens only (no hex, no `px` font sizes, no `outline: none`, no `@import`, no universal selector); no `innerHTML` or `dangerouslySetInnerHTML`; no third-party requests, fonts or icon CDNs; the budget grid is a `<table>`; native `<dialog>` for sheets; the theme control is two-state; `engine/` never imports UI, storage, sync, DOM; do not add dependencies, and do not approve any pnpm dependency build script beyond `esbuild` and `workerd`, without asking the owner. `Commits` states: Conventional Commits `type(scope): lowercase imperative`, a terse `- add ...` bullet body, no co-author or tool trailers, that the agent writes the message from the actual diff and the owner commits (print the message and stop), and points to `docs/guidance/commit-style.md` for the full rules. `Definition of done` copies the checklist from `docs/guidance/modern-web.md` section 11. `Reading list`: the spec, `docs/guidance/modern-web.md`, `docs/guidance/commit-style.md`, the decision record, the current plan.
- Produces: `.cursor/rules/kaban.mdc` with front matter `description: Kaban project rules`, `globs:` (empty), `alwaysApply: true`, and a body that tells the agent to read and follow `AGENTS.md` and `docs/guidance/modern-web.md` before any change and repeats only the five most violated hard rules.
- Produces: `docs/templates/HANDOFF.md` with sections `What changed`, `How to verify` (commands and expected results), `Not tested`, `Known issues`, `Decisions made that the plan did not specify`, `Questions for the reviewer`.

- [ ] **Step 1: Write the failing test** `tools/agents.test.ts`: `AGENTS.md` contains each required section heading in order; every row of its `Pinned versions` table matches the exact version of the same name in `package.json` (dependencies and devDependencies), and every dependency in `package.json` appears in the table; the text includes `pnpm verify`, `docs/guidance/modern-web.md`, and `Conventional Commits`; `.cursor/rules/kaban.mdc` starts with front matter containing `alwaysApply: true` and mentions `AGENTS.md`; `docs/templates/HANDOFF.md` contains all six section headings.
- [ ] **Step 2: Run to see it fail.** Run `pnpm test tools/agents.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the three files** per the content decisions. Generate the pinned-versions table from `package.json` so it cannot drift.
- [ ] **Step 4: Run the test and `pnpm verify`.** Expected: PASS.
- [ ] **Step 5: Commit checkpoint.** Files: the three files and the test. Message:
  ```
  docs(agents): add agent instructions, cursor rule, and handoff template

  - add AGENTS.md with commands, pinned versions, folder boundaries, hard rules, and commit format
  - add an always-on cursor rule that points at AGENTS.md and the modern web rules
  - add a handoff template for the reviewer
  - test that the pinned versions table matches package.json
  ```

### Task 13: Deploy and final verification

**Files:**
- Create: `docs/handoffs/plan-1.md` (from the template)

- [ ] **Step 1: Run everything locally.** Run `pnpm verify:e2e`. Expected: exit code 0 with all unit and e2e tests passing in both Playwright projects.
- [ ] **Step 2: Human step: deploy.** The owner runs `pnpm exec wrangler login` (once), then `pnpm exec wrangler pages project create kaban --production-branch main`, `pnpm build`, and `pnpm exec wrangler pages deploy dist --project-name kaban`. Expected: a `.pages.dev` URL. Open it on the laptop and the phone, install the app on the phone, then turn on airplane mode and open it from the home screen. Expected: the shell loads offline and the theme and density settings persist.
- [ ] **Step 3: Check the deployed headers.** In Chrome DevTools, Network tab, reload the deployed page and confirm the response includes `Content-Security-Policy-Report-Only`, `X-Content-Type-Options` and `Strict-Transport-Security`, and that the Console shows no CSP violations (report-only messages are warnings; any message about the theme script means the hash is wrong).
- [ ] **Step 4: Fill the handoff.** Copy `docs/templates/HANDOFF.md` to `docs/handoffs/plan-1.md` and fill every section from real results, including anything you decided that this plan did not specify, and any step you could not complete.
- [ ] **Step 5: Commit checkpoint.** File: `docs/handoffs/plan-1.md`. Message:
  ```
  docs(handoffs): add plan 1 handoff for review

  - record verification results, untested areas, and decisions made during the build
  - list questions for the reviewer
  ```

## Self-review notes

- Spec coverage: tooling and `pnpm verify` and guardrails (spec 3, 7, 8; Tasks 1 and 2), money and date rules (spec 3; Task 3), two-state theme and density (spec 2, 6.4; Tasks 4 and 9), tokens, contrast and fonts (spec 6.2, 6.3; Task 5), status display and components (spec 6.5; Task 6), sheets, toasts, forms (spec 6.7, 6.8, guidance sections 6 and 7; Tasks 7 and 8), laptop, tablet and phone shell and five tabs (spec 6.6, 6.7; Task 9), PWA and persistence (spec 8, 9; Task 10), security headers (spec 9; Task 11), `AGENTS.md` and Cursor rules (spec 8; Task 12). Not in this plan, by design: the budget table, inspector content, Home, Spending, Accounts and Reflect screens (Plans 2, 3 and 6), storage and sync (Plan 2 after the Plan 0 decision), command palette and shortcuts (Plan 8), the Nothing Serif font file (owner supplies it).
- Type names are defined once and reused: `Result`, `Centavos`, `MoneyParseError`, `ThemePref`, `Density`, `ToastItem`, `ToastOptions`, `StatusKind`, `MoneyFieldState`, `NavItem`.
- Task 4 and Task 5 each include an e2e test file that can only run after Task 6 creates the Playwright config; their steps say so explicitly.
