# Kaban: Master Design Spec

Date: 2026-10-05
Status: Approved. Revised the same day: the visual language changed from "Nothing's taste" to the owner's own Wantap language (warm ink, coral, Syne and Plus Jakarta Sans). Sections 2 and 6 and `docs/guidance/modern-web.md` sections 3 and 4 were rewritten for it. Product structure, budget rules, architecture and plans are unchanged.

Kaban is a personal, zero-based budgeting app that reproduces YNAB's full methodology and feature set, minus bank linking. It is built as a local-first installable web app (PWA). Its structure follows YNAB. Its look follows the owner's Wantap design language (wantap.cc): warm near-black, one coral accent, large soft controls.

Companion files:
- `docs/guidance/modern-web.md`: the modern web rules every UI task must follow (self-contained, written for Grok).
- `docs/design/kaban-mock.html`: a responsive, interactive visual reference (laptop, tablet, phone). **Superseded for look:** it still shows the old Nothing styling (black, charcoal, serif, red). Use it only for screen structure and layout. The look is defined in section 6.
- `docs/design/kaban-devices.html`: the same mock in phone, tablet and laptop frames. Same note.
- The Wantap source (`C:\Users\gelo\Documents\GitHub\wantap.cc`, or github.com/gelolaus/wantap.cc) is the look reference: `src/app/globals.css` (tokens), `src/components/ui/button.tsx`, `input.tsx`, `card.tsx`, `src/components/layout/dashboard-shell.tsx`, `app-section.tsx`, and `src/fonts/`. It is a look reference only. Do not copy its Tailwind, shadcn or Next.js code.

## 1. Purpose and success criteria

**Why it exists.** YNAB costs about 6,000 PHP per year, which is too much for a student. Kaban replaces it for one user who already budgets in YNAB.

**Success means:**
1. Every YNAB feature the user relies on exists, except automatic bank linking. Data enters by hand or by file import.
2. Kaban's numbers match YNAB's for the same inputs. This is checked by golden tests (section 7).
3. The app is faster than YNAB to use. Every edit is instant because writes go to the local database first.
4. It works fully offline on phone and laptop, and the two stay in sync.
5. It keeps YNAB's structure and has the clean, warm look of the owner's Wantap language (section 6).
6. It follows modern web platform practice (`docs/guidance/modern-web.md`), is accessible, and loads no third-party code.

**Audience:** one user, personal use, one budget in PHP. Multi-user and multi-currency are non-goals for now.

## 2. Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Platform | Installable web app (PWA). Adaptive layout, laptop and phone equally important. |
| Data | Local-first. Optional free cloud sync between the user's own devices. Manual JSON/CSV export as a backup. |
| Sync engine | Decided by Plan 0 (a spike). Order of preference: Turso Sync, then Evolu, then a custom change log on Supabase. |
| Architecture | React + TypeScript (strict) + Vite PWA, a pure budget engine, SQLite or IndexedDB storage behind a repository interface. |
| Styling | Plain CSS with cascade layers, design tokens as custom properties and container queries. No Tailwind (its global reset conflicts with the modern web rules), no CSS-in-JS runtime. |
| Visual direction | YNAB's structure in the owner's Wantap language: warm near-black canvas, soft warm cards, Syne headings, Plus Jakarta Sans body, one peach-coral accent, large rounded controls, flat and quiet, plus one red signal for overspending. Replaces the earlier Nothing direction (black, charcoal, serif, red). Rejected: dot-matrix fonts, dot-grid backgrounds, uppercase mono labels, rectangular "techno" buttons, spreadsheet hairline look, glows, gradients and decoration. |
| Density | Compact by default on laptop (YNAB-like, rows about 36 px). A Comfortable option. Phone always uses touch sizes. |
| Currency | PHP only. The currency code is stored on the budget so more can be added later. |
| Theme | Light and dark. Default follows the system. The manual control is two-state: "use system" or "use the opposite", persisted per device. |
| Status display | Warm monochrome plus one red signal. Coral is the brand accent (actions, selection, highlight) and is never used to mean a status. Thin solid progress bars. No dot-matrix font or dot bars. |
| Fonts | Syne (titles, large numbers) and Plus Jakarta Sans (everything else), copied from Wantap's `src/fonts/` and self-hosted. No monospace face. No Nothing fonts, Geist or Newsreader. |
| Phone navigation | Five tabs like YNAB's mobile app: Home, Plan, Spending, Accounts, Reflect, plus an extended "+ Transaction" button. |
| Browser support | Chromium-first (current Chrome and Edge on Windows, Chrome on Android). Firefox and Safari best effort. Confirmed by the owner. |
| Dev workflow | Grok 4.7 High builds in Cursor from written plans. Claude Opus 5.5 reviews and fixes. Conventional Commits throughout. |
| YNAB verification | Phases 1 and 2 rules are verified. Each later phase is verified just before its plan is written. |

## 3. Architecture

One Vite package with hard folder boundaries.

```
src/
  engine/    Pure TypeScript budget math. No React, no database, no I/O.
  domain/    Types and Zod validation for budgets, accounts, categories, transactions, targets.
  storage/   Repository interfaces and the chosen implementation, migrations.
  sync/      Sync adapter (implementation depends on Plan 0).
  state/     Thin hooks: live queries to engine to view models.
  ui/        Design system: tokens.css, fonts, base layer, components.
  features/  home/ plan/ spending/ accounts/ reflect/ settings/
  app/       Shell, routing, PWA registration.
```

**Data flow.** A user action becomes a validated command. The command writes through a repository. A live query feeds the engine, which derives the month view, and the UI renders it. Undo and redo replay inverse commands from a command log.

**Rules.**
- Money is integer centavos everywhere. There are no floats. Entered text is parsed to centavos with string logic, never `parseFloat`. One function formats the peso sign and separators (`Intl.NumberFormat`, with the true minus sign).
- Dates are `Temporal.PlainDate` and months are `Temporal.PlainYearMonth` in code, stored as ISO strings (`2026-10-05`, `2026-10`). `Date` is not used for date logic. `Temporal` is loaded from `@js-temporal/polyfill` only when the browser lacks it.
- IDs are ULIDs generated on the device, so records can be created offline without collisions.
- Rows are soft-deleted (`deleted_at`) so undo, redo and sync stay deterministic.
- Derived numbers (Assigned, Activity, Available, Ready to Assign, balances) are computed by the engine and never stored.
- A lint rule forbids `engine/` from importing React, the storage layer or any DOM API.
- Commands return success or typed error results. The UI shows inline errors. A storage failure shows a persistent notice with Retry and Export backup.
- UI code follows `docs/guidance/modern-web.md`. Tooling enforces the mechanical parts (section 7).

**Conflict-safe money model.** Assignments are an append-only ledger of deltas, not mutable totals. Editing a category's Assigned cell to a new value writes one entry equal to the difference. Moving money between categories writes two entries sharing a `move_id`. Totals are sums of entries. Transactions are inserts. Edits to other rows (accounts, categories, targets, transaction fields) use last-write-wins, which is acceptable for a single user's two devices. This keeps two devices from silently overwriting each other's money movements regardless of which sync engine is chosen.

**Backups.** Independent of sync: a scheduled local snapshot and a manual full export (JSON) and import. A sync bug must never be the only copy of the data.

## 4. Data model

All records carry `id` (ULID), `created_at`, `updated_at`, `deleted_at`.

| Record | Key fields |
|---|---|
| Budget | name, currency (`PHP`), settings |
| Account | name, type, on_budget, closed, sort_order, note |
| Payee | name, transfer_account_id (optional), last_category_id |
| CategoryGroup | name, sort_order, hidden |
| Category | group_id, name, sort_order, hidden, note, icon (optional emoji or icon name), kind (`normal` or `credit_card_payment`), account_id (for payment categories) |
| Transaction | account_id, date, payee_id, category_id, memo, amount_centavos (signed), cleared (`uncleared`, `cleared`, `reconciled`), flag, approved, transfer_transaction_id, scheduled_id |
| SplitLine | transaction_id, category_id, amount_centavos, memo |
| AssignmentEntry | category_id, month (`YYYY-MM`), delta_centavos, move_id (optional) |
| Target | category_id, type, amount_centavos, due_date or cadence, snoozed_month |
| ScheduledTransaction | transaction template, frequency, next_date, auto_enter |
| MonthNote | month, text |
| Pin | category_id, sort_order (the Home tab's pinned categories) |
| CommandLog | command, inverse, timestamp (local only, for undo and redo) |

**Account types** (verified in YNAB): cash accounts (Checking, Savings, Cash); credit accounts (Credit Card, Line of Credit); loans (Mortgage, Auto Loan, Student Loan, Personal Loan, Medical Debt, Other Debt); tracking accounts (Asset, Liability). Tracking accounts are off budget.

**Starting balance.** Creating an account with a balance creates a cleared transaction, payee "Starting Balance", category "Inflow: Ready to Assign" (verified). For credit cards the category is not needed.

## 5. Budget rules (the YNAB rule book)

Verification status was checked against the live YNAB app in a throwaway test plan on 2026-10-05.

| # | Rule | Status |
|---|---|---|
| R1 | Ready to Assign = all inflows to Ready to Assign minus all assigned money across months, minus cash overspending carried from earlier months. | Verified |
| R2 | Available(category, month) = Available(previous month) + Assigned(month) + Activity(month), for non-negative carryover. | Verified |
| R3 | Cash overspending: the category resets to 0 next month and the shortfall is deducted from next month's Ready to Assign. | Verified |
| R4 | Credit overspending: the category resets to 0 next month. Ready to Assign is not affected. The shortfall remains as unfunded card debt. | Verified |
| R5 | Credit card spending moves money from the spending category into that card's payment category, limited to the amount that was available. Payments from a cash account draw the payment category down. | Verified |
| R6 | Targets: each type computes "needed this month". This drives Underfunded and Overfunded filters, Cost to Be Me and Auto-Assign. | Verify before Plan 3 |
| R7 | Age of Money is computed first-in-first-out over inflows. | Verify before Plan 6 |
| R8 | Tracking accounts are off budget and only feed net worth. | Verify before Plan 4 |
| R9 | Loans: payment categories, interest and escrow handling. | Verify before Plan 4 |

**Verified UI facts** to reproduce: the category inspector breaks a month into Left Over, Assigned, Cash Spending and Credit Spending. A credit card register shows header chips "Overspending (month)" and "Payment". The category picker shows each category's available balance and supports inline creation of categories and payees, Split, and Payment/Transfer. Month navigation in YNAB stops one month ahead of the current month. YNAB takes about 4 seconds to sync an edit.

## 6. Design system: YNAB structure, Wantap language

### 6.1 Direction

Kaban keeps YNAB's information architecture and workflows, so a YNAB user feels at home. Its visual style is the owner's Wantap language (wantap.cc), which the owner finds far cleaner than the earlier Nothing direction. What carries over:
- A warm near-black canvas (hue about 55, never neutral gray) with soft warm cards.
- One peach-coral accent, `#E8A87C`. Filled coral controls always carry dark text.
- Syne for titles and large numbers, Plus Jakarta Sans for everything else.
- Large, soft, rounded controls: 44 px high by default, 48 px for the main call to action.
- Spacious sections with a 1px low-contrast border and a mostly opaque card fill.
- Flat and quiet: no glow, no gradient, no dot grid, no decorative shadow.

Kaban adds one thing Wantap does not have: a red signal for overspending, because a budget needs a status color that cannot be mistaken for the brand accent (section 6.5).

Kaban differs from Wantap in two ways. Wantap's app is dark only; Kaban keeps a light theme and the two-state theme control (section 2). Wantap is a marketing and builder app; Kaban's laptop layout is a dense three-column budget (section 6.6), so Compact density keeps 36 px rows.

### 6.2 Color tokens

Contrast was measured against WCAG (computed from the exact values below). Text needs 4.5:1. UI components and large text need 3:1. Hex values live only in `tokens.css`. The dark values are Wantap's OKLCH tokens converted to sRGB, with the translucent card composited on the canvas.

| Token | Dark | Light | Wantap source or use |
|---|---|---|---|
| `--bg` | `#0C0806` | `#FAF6F1` | `oklch(0.14 0.01 55)`. Page canvas. |
| `--surface` (card) | `#140E0B` | `#FFFDFA` | `oklch(0.18 0.012 55 / 75%)`. Cards and sections. |
| `--surface-header` | `#1C1612` | `#F5F1EC` | Group header rows, sheet headers. |
| `--surface-selected` | `#221C18` | `#F1EAE3` | Hover and selected row without the accent. |
| `--control` (chips, secondary buttons) | `#241E1A` | `#EAE3DC` | `oklch(0.22 0.012 55)` secondary. |
| `--track` (progress track) | `#332C28` | `#DDD6CF` | Low contrast on purpose. |
| `--ink` | `#F6F1EB` | `#190F09` | `oklch(0.96 0.01 75)`. Primary text. |
| `--ink-2` (secondary text) | `#AEA298` | `#61564D` | `oklch(0.72 0.02 65)`. |
| `--line` (decorative border) | `#25211F` | `#E3DFDA` | White (dark) or ink (light) at 10% over the canvas. Cards and dividers only. |
| `--line-strong` (control border) | `#7A6F66` | `#8F847A` | Input and chip outlines. 3:1 or better. |
| `--accent` (fill) | `#E8A87C` | `#E8A87C` | Primary buttons, Ready to Assign pill, active nav pill. |
| `--on-accent` | `#190F09` | `#190F09` | Text and icons on `--accent`. |
| `--accent-text` | `#E8A87C` | `#844925` | Coral as text or an icon outside a fill. |
| `--accent-wash` | `#3A2A1F` | `#FBEEE4` | `--accent` at 18% over `--surface`. Selected row, active nav. |
| `--signal` | `#C8102E` | `#C8102E` | Overspending only. |

Measured contrast:
- Dark: `--ink` on `--bg` 17.72, on `--surface` 17.02. `--ink-2` on `--bg` 8.00, on `--surface` 7.69, on `--surface-selected` 6.80, on `--control` 6.62, on `--accent-wash` 5.52. `--on-accent` on `--accent` 9.27. `--accent` on `--surface` 9.41. `--line-strong` on `--surface` 3.93, on `--control` 3.38.
- Light: `--ink` on `--bg` 17.53. `--ink-2` on `--bg` 6.66, on `--surface` 7.06, on `--surface-selected` 6.00, on `--control` 5.65, on `--accent-wash` 6.28. `--accent-text` on `--bg` 6.58, on `--surface` 6.97, on `--accent-wash` 6.20. `--on-accent` on `--accent` 9.27. `--line-strong` on `--surface` 3.60, on `--bg` 3.40.
- Signal: white on `--signal` 5.88. `--signal` as text is 3.39 on dark `--bg` and 3.25 on dark `--surface`, so it fails for small text on dark. It is 5.47 on light `--bg`.

Rules:
- `--accent` as a fill on the light canvas is only 1.89:1 against `--bg`. That is acceptable only because the label inside is 9.27:1 and names the control. Do not use a bare coral shape with no text or icon as the only cue for something. Use `--accent-text` for coral text or icons on light.
- Never use `--accent` or `--accent-text` for text on a light surface (`--accent` alone is about 1.9:1).
- `--signal` is only a fill with white text, a 1px border, or a bar fill. It is never small text on dark.
- Form control outlines use `--line-strong`, not `--line` (a 10% white border is about 1.25:1 and fails 3:1).
- Coral never means a status. Funded, underfunded, overspent and zero (section 6.5) are warm gray and red only, so a coral pill is always an action or a selection, never a warning or a state.
- The highlight surface (the Ready to Assign pill and the phone banner) is `--accent` with `--on-accent` text in both themes.
- No gradients, no glows, no textures, no background patterns, no decorative shadows. Separation comes from tonal fills and 1px lines.
- Status is never color alone.

### 6.3 Typography

- **Syne** (weights 400 to 800, use 600 for titles): month title, view titles, inspector title, the wordmark, and the large numbers (Ready to Assign). Tracking slightly tight.
- **Plus Jakarta Sans** (weights 200 to 800): all other text. Money uses `font-variant-numeric: tabular-nums` in every table and list so columns align. There is no monospace face.
- Both are the files from Wantap's `src/fonts/`, copied into the repo and self-hosted as woff2. Nothing is loaded from a CDN. Syne's headings stay out of table cells.
- Sizes are in `rem`. Compact laptop body text is `0.8125rem` (13 px), Comfortable and phone `0.875rem` to `1rem`. Month and inspector titles about `1.375rem`. View titles on phone about `1.75rem`. Page titles on laptop comfortable about `2rem`. The laptop Ready to Assign amount about `1.125rem`. The phone banner amount about `1.875rem`. Form inputs are never smaller than `1rem`.
- Font files are self-hosted woff2 with metric-matched fallbacks. See `docs/guidance/modern-web.md` section 4. The peso sign and tabular numerals must be verified (section 11).

### 6.4 Density and shape

Wantap's radius is `--radius: 0.875rem`, with a scale derived from it: `--radius-xl` about 1.225rem (controls) and `--radius-3xl` about 1.925rem (large sections). Kaban uses the same scale.

| Property | Compact (laptop default) | Comfortable | Phone |
|---|---|---|---|
| Row height | 36 px | 52 px | 56 px |
| Control height (buttons, inputs, chips) | 36 px | 44 px | 44 px (48 px for the main call to action and inputs) |
| Control radius | `--radius-xl` | `--radius-xl` | `--radius-xl` |
| Card radius | `--radius-xl` | `--radius-3xl` | `--radius-3xl` |
| Card padding | 16 px | 24 px | 20 px |
| Card gap | 12 px | 24 px | 16 px |
| Progress bar thickness | 2 px | 4 px | 4 px |
| Category icon bubble | hidden | shown | shown |

- Density is set with a `data-density` attribute and tokens, stored per device, and changed in Settings. It does not use container style queries.
- Controls (buttons, chips, filters, month switcher, search) are rounded to `--radius-xl` and may be pills or circles. Containers are rounded cards with a 1px `--line` border.
- Navigation: the laptop sidebar is about 224 px, with a rounded active pill using `--accent-wash` and a coral icon. On phone the five-tab bar is fixed to the bottom with safe-area padding, and the active tab uses `--accent-text`.
- Touch targets stay at 44 px on `pointer: coarse` whatever the density (modern-web section 5).

### 6.5 Status display

Funded, underfunded and zero are warm grays. Overspent is the only red. Coral is never a status.

- **Funded:** a `--control` pill with the amount in `--ink`.
- **Underfunded:** a 1px `--line-strong` outlined pill, a caption ("₱400.00 more needed by the 1st"), and a partly filled thin bar in `--ink`.
- **Overspent:** a `--signal` pill with white text "▲ −₱500.00", a `--signal` bar, and a caption ("Overspent: ₱3,500.00 of ₱3,000.00"). The filter chip shows "N overspent" with a small signal dot.
- **Zero:** a plain `--ink-2` number.
- **Over-assigned Ready to Assign:** the pill switches from `--accent` to `--signal` with white text and the "▲" marker.
- Credit card payment categories show "Available for payment" in the group header.

### 6.6 Laptop layout (1100 px and wider)

Three columns: sidebar, budget table, inspector.
- **Sidebar** (about 220 px, collapsible): plan name; Plan, Reflect, All accounts, Spending; accounts grouped by type with balances; Add account. There is no bank-connections item.
- **Top bar:** month switcher (previous, "October 2026", next, optional note); the Ready to Assign pill with an Assign button; filter chips (All, Overspent, Underfunded, Overfunded, Money available, Snoozed); toolbar (+ Category group, Undo, Redo, Recent moves).
- **Budget table:** a real `<table>`. Columns Category, Assigned, Activity, Available. Each category group is a card with a header row of totals. Rows show the name, an optional caption and thin bar, the three amounts, and the status pill. The selected row is highlighted.
- **Inspector (about 380 px):** for a selected category: available balance, the breakdown (left over, assigned, cash spending, credit spending), an Assign box with quick-add buttons, the overspent warning with "Cover overspending", the Target section, Auto-assign, Notes. With nothing selected: the month summary (left over, assigned, activity, available), Cost to Be Me, Auto-assign, assigned in future months.
- Keyboard: Ctrl+K command palette, YNAB-style shortcuts (N for a new transaction), Undo and Redo.

**Tablet (761 to 1099 px):** the sidebar becomes an icon rail and the inspector becomes a slide-in drawer.

### 6.7 Phone layout (760 px and narrower)

Follows YNAB's mobile app, confirmed from the user's own screenshots and YNAB's Play Store listing.
- **Navigation:** a floating bar with five tabs (Home, Plan, Spending, Accounts, Reflect) and an extended "+ Transaction" button above it on every tab except Reflect.
- **Home:** a "Pinned" card (pinned categories with their available amount, an Edit button) and a "Current goal" card with a progress ring ("73% Complete"), Funded and To go values, and an Adjust button.
- **Plan:** header with the month and a dropdown, filter, edit and more icons; the Ready to Assign banner; filter chips; category group cards with the caption "Available to spend" (or "for payment"); rows with the status pill, status line and bar. Tapping a row opens the inspector as a bottom sheet.
- **Spending:** every transaction grouped by date, each with payee, amount, category chip, account name and a cleared, uncleared or reconciled icon.
- **Accounts:** grouped as Cash, Credit and Loan with a total per group and a balance per account.
- **Reflect:** cards for Spending breakdown, Income vs. spending (a monochrome bar chart with a text alternative) and Net worth.
- **Add transaction sheet:** an Outflow, Inflow, Transfer switch; a large Syne amount; a grouped details card (payee, category with its remaining balance, account, date defaulting to today); a keypad; a Save button. Target: under five seconds. The money field is a text input with `inputmode="decimal"`.

### 6.8 Motion and interaction

- 120 to 180 ms ease-out. Sheets and dialogs use `@starting-style` entry transitions. Tab and view changes use view transitions where supported. Everything is disabled or simplified under `prefers-reduced-motion`.
- Swipe actions on phone rows use CSS scroll snap. Every swipe action also has a visible control and a keyboard path.
- Numbers update instantly (local-first). A short haptic tick on save where `navigator.vibrate` exists.
- Theme control is two-state. Density is a setting.

### 6.9 Copy and accessibility

- Copy is calm and terse: sentence case, verb-first buttons, no exclamation marks, no "please" or "successfully".
- Accessibility follows `docs/guidance/modern-web.md` section 5: landmarks, a semantic table, visible focus, 24 px minimum targets (44 px on coarse pointers, 48 px for inputs), live-region announcements for saves, no color-only status.

### 6.10 Reference artifacts

`docs/design/kaban-mock.html` (breakpoints at 1100 px and 760 px) shows every screen above. It has working budget math (assign, cover overspending, add a transaction), a theme control, a density control, and a reset. It is a reference for screen structure and layout only. Its colors, fonts, radii and sizes are the old Nothing look and are superseded by sections 6.1 to 6.5. It also intentionally breaks several implementation rules, listed in `docs/guidance/modern-web.md` section 12. Match its structure, not its look or its code. For the look, use Wantap (section 6.1) and the tokens in section 6.2.

## 7. Testing and verification

- **Engine:** table-driven Vitest tests for every rule in section 5.
- **Golden scenarios** recorded from live YNAB (made-up numbers):
  - G1: a 10,000.00 starting balance gives Ready to Assign 10,000.00.
  - G2: assign 3,000.00 to Groceries and 1,000.00 to Dining out. Ready to Assign becomes 6,000.00.
  - G3: spend 3,500.00 in cash on Groceries. Groceries available is −500.00 and Ready to Assign stays 6,000.00. In the next month Groceries is 0.00 and Ready to Assign is 5,500.00.
  - G4: spend 1,200.00 on a credit card in Dining out (1,000.00 available). Dining out is −200.00 available, the card's payment category holds 1,000.00 and Ready to Assign stays 6,000.00. In the next month Dining out resets to 0.00, Ready to Assign is unchanged by the credit overspend, and the payment category still holds 1,000.00.
- **End to end:** Playwright flows at 360, 820 and 1440 px, including offline and reconnect, keyboard-only walkthroughs, and `prefers-reduced-motion`.
- **Accessibility:** automated axe checks in Playwright on every screen, plus the manual checklist in `docs/guidance/modern-web.md` section 11.
- **Style guardrails** (Plan 1): Stylelint rules forbid `px` font sizes, hex colors outside `tokens.css`, `@import`, and the universal selector in component CSS. A lint rule forbids `innerHTML` and `dangerouslySetInnerHTML`.
- **Boundaries and quality:** one command, `pnpm verify`, runs typecheck, lint, Stylelint, unit tests, the engine-boundary check and a build.
- **Later:** a YNAB export import (Plan 7) enables a real-data golden-master comparison.

## 8. Phases and plans

Each plan is its own file in `docs/superpowers/plans/`, written for Grok 4.7 High in Cursor.

| Plan | Scope |
|---|---|
| 0 | Storage and sync spike (throwaway). Output is a decision record. |
| 1 | Foundation and design system: scaffold, tooling and guardrails, `tokens.css`, self-hosted fonts, core components, app shell (laptop, tablet, phone), PWA, `AGENTS.md` and `.cursor/rules/` that point at `docs/guidance/modern-web.md`. |
| 2 | Core engine and Plan screen: ledger, engine, accounts, transactions, assigning, rules R1 to R5, the Spending screen, the Accounts screen, the add-transaction sheet. |
| 3 | Targets and Auto-Assign: all target types, Cost to Be Me, filters, move money, Undo, Redo, Recent Moves, and the Home tab (pinned categories, current goal ring). |
| 4 | Credit cards and loans, tracking accounts. |
| 5 | Advanced transactions: splits, transfers, scheduled, flags, cleared and reconciled, payee memory. |
| 6 | Reflect: spending breakdown, income vs spending, net worth, Age of Money. |
| 7 | Import and export: CSV, OFX, QIF, and a YNAB export import. |
| 8 | Sync and PWA polish: pairing, install prompt, shortcuts, onboarding. Sync work may move earlier depending on Plan 0. |

**Plan 0 spike pass criteria** (all in a throwaway PWA, on the user's laptop and phone):
1. Turso's browser sync package opens a database persisted in OPFS.
2. A write made offline in the browser survives a reload and a killed tab.
3. Push and pull works between a laptop browser and the installed phone PWA.
4. Two offline edits to different ledger entries both survive after both devices sync.
5. It works with Vite and a service worker, and any required HTTP headers are known.
6. Storage persistence on the phone is confirmed (including `navigator.storage.persist()`).
If any criterion fails, repeat the spike with Evolu. If that fails, use IndexedDB plus a custom change log on Supabase, as originally designed.

**Plan authoring rules.** Every task lists exact file paths, writes a failing test first, shows the full minimal code, gives the exact command and expected output, and ends with a Conventional Commits message. Every task that touches UI cites the relevant sections of `docs/guidance/modern-web.md` and ends with its section 11 checklist. The repo carries `AGENTS.md` and `.cursor/rules/` covering pinned versions, folder boundaries, the integer-centavos rule, the design-token rule and the commit format. After each plan, Grok writes a `HANDOFF.md` (what changed, what is untested, known issues) for Claude Opus 5.5, which reviews against the golden tests.

## 9. Security and privacy

- Single user. No third-party analytics, no third-party scripts, and no CDN fonts or icons. Everything is self-hosted.
- HTTPS only with HSTS. A hash-based Content Security Policy, introduced in report-only mode and then enforced. Trusted Types in report-only mode first.
- Untrusted text (payees, memos, imported files) is only ever rendered as text, never through an HTML sink.
- Sync credentials are entered or scanned once per device (a pairing step). They are stored in IndexedDB or an OPFS file, never in `localStorage`, source files, URLs or logs. Backups exclude them.
- "Remove data from this device" deletes the local database and credentials and clears site data.
- Real budget data is not placed on sync infrastructure until Plan 0 passes and backups exist.
- Export files are plain JSON and stay on the user's devices.

## 10. Non-goals

Bank linking or any automatic bank import. Multi-user accounts, sharing and public release. Multi-currency budgets. Native mobile apps (a Capacitor or Tauri wrapper may be added later without a rewrite).

## 11. Open items

- **Wantap fonts:** Syne and Plus Jakarta Sans come from Wantap's `src/fonts/` (licenses in its `ATTRIBUTION.txt`). To verify during the re-skin: the peso sign `₱` and the minus `−` render from these files (otherwise add a self-hosted fallback), and Plus Jakarta Sans gives tabular numerals so money columns align. If Syne digits read badly for large amounts, large amounts use Plus Jakarta Sans bold instead. The agent reports the outcome.
- **Mock refresh:** `docs/design/kaban-mock.html` and `kaban-devices.html` still show the Nothing look. Either re-skin them to section 6 or retire them once the app itself is the reference.
- **Turso Sync:** general-availability status and exact browser requirements will be confirmed by Plan 0 against Turso's current documentation.
- **YNAB rules and features not yet verified:** R6 to R9, Auto-Assign, Reflect, scheduled transactions, splits and reconcile. These are verified per phase.
- **modern-web-guidance in Cursor (optional):** the project publishes Cursor and Grok plugin packages. If the owner installs it in Cursor, Grok can run the CLI for the full guides. The distilled rules in `docs/guidance/modern-web.md` work without it.
