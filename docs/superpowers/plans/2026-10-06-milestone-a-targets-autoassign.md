# Milestone A: targets, Auto-Assign, moving money, Undo

Date: 2026-10-06
For: the coding agent in Cursor, working directly on `main`.
Rules source: `docs/superpowers/specs/2026-10-06-ynab-targets-autoassign-rules.md` (row ids T1 to T9, S1 to S7, Z1 to Z6, C1 to C4, A1 to A9, M1 to M6). Read it first. This brief says what to build; that file says how YNAB behaves.

Do not edit anything under `docs/`. Follow `AGENTS.md`, `docs/guidance/modern-web.md` and `docs/guidance/commit-style.md`. The look is the Wantap design in spec section 6.

## 1. Goal

Finish the Plan screen the way YNAB works: set targets, see what each category still needs, let Auto-Assign fund the month, move money between categories, and undo mistakes. Also fill in the Home tab (pinned categories and the current goal ring).

Done means the owner can: set a target on a category, see "₱X more needed" and a status that matches YNAB's colors, press Underfunded and watch a preview fill the month, snooze a target, move money and cover overspending, undo and redo with Ctrl+Z and Ctrl+Y, and see all moves in Recent Moves. Nothing about the existing data may be lost.

## 2. Scope

In: targets (all cadences and behaviors), per-category and per-month status, snooze, Cost to Be Me with expected income, Auto-Assign (A1 to A9) with preview, Move Money, Cover overspending, Undo, Redo, Recent Moves, working Plan filters and selection, an Inspector that matches section 5 of the rules file, Home tab (Pinned and Current goal ring), a progress-bar setting, versioned database migrations, backup format v2.

Out (later milestones): scheduled transactions, credit card payoff targets and the credit card payment tier of Underfunded (Milestone B), Reflect, import, sync. Leave clear extension points for the tier 2 scheduled-transaction ordering and tier 5 in `autoAssign`.

## 3. Data changes (storage)

The current `migrate()` only runs `CREATE TABLE IF NOT EXISTS`, which cannot change an existing table. **Add versioned migrations first**:

- Store `schema_version` in the `meta` table. Migration 1 is today's schema. Migration 2 is this milestone. Run migrations in order, each in a transaction. Existing data must survive. Add a test that builds a database at version 1 with data, runs the new migration, and checks that every old row is still there.

New tables (all with `id`, `budget_id`, `created_at`, `updated_at`, `deleted_at` like the others):

| table | columns |
|---|---|
| `targets` | `category_id` (one active row per category), `cadence`, `behavior`, `amount_centavos`, `weekday`, `due_day` (integer or `'end'`), `due_month` (`YYYY-MM`), `repeat`, `repeat_behavior` |
| `target_snoozes` | `category_id`, `month` |
| `moves` | `kind` (`assign`, `move`, `auto_assign`, `cover`, `delete_category`), `month`, `undone_at` (nullable), `created_at` |
| `budget_settings` | `key`, `value`, for `expected_income_centavos`, `current_goal_category_id`, `progress_bars` |

`assignment_entries.move_id` already exists. From now on every assignment write goes through one `moves` row: typing a new assigned amount, Move Money, cover, and each Auto-Assign option. Rows with a null `move_id` from before this milestone stay valid but do not show in Recent Moves and cannot be undone.

- **Undo** soft-deletes the move's assignment entries (`deleted_at`) and sets `moves.undone_at`. **Redo** reverses both. Redo is only offered while no new move has been made since the undo.
- Repository methods for all of this are transactional (`runTx`) and use bound parameters. No string-built SQL.
- **Backup version 2** adds `targets`, `targetSnoozes`, `moves` and `settings`. The importer still accepts version 1 (the new tables stay empty). Validate everything as before, and keep the confirmation and export-first prompt.

## 4. Engine (pure, in `src/engine/`)

No React, storage or clock. The caller passes `currentMonth`.

New files `targets.ts` and `autoAssign.ts`, plus extra helpers in `months.ts` (weekday counts per month, months left through a due month).

- Extend `BudgetSnapshot` with optional `targets` and `snoozes`. Existing tests must pass unchanged.
- `computeTargets(snapshot, month, currentMonth)` returns, for every category with a target: `needed`, `askThisMonth`, `status` (S1 to S7), `snoozed`, and `progress`. It follows T1 to T9 exactly.
- `costToBeMe(snapshot, month, currentMonth, expectedIncome)` follows C1 to C4, returning `thisMonth`, `nextMonth` (only when higher), and `margin`.
- `autoAssignPreview(snapshot, month, currentMonth, option, scope)` returns a list of `{categoryId, delta}` plus `readyToAssignAfter`. `option` is one of the eight options. `scope` is `{categoryIds}` or the whole plan. Underfunded follows section 3.1 of the rules file, including the tie-break (top to bottom) and tier 1.
- Each assumed rule gets its own `describe('assumed (...)')` block, so a correction is a table change.

Properties to test (as in `compute.properties.test.ts`):
- Applying any Auto-Assign preview, Move Money or Undo never changes total cash. The cash identity from R-properties still holds.
- A move between two categories never changes Ready to Assign.
- Undo of a move restores every number exactly. Undo then Redo equals the move.
- Underfunded with no selection never makes Ready to Assign negative.
- Results are deterministic and independent of input order.

## 5. Screens and behavior

Use the Wantap tokens and components already in the repo. Keep all rules in `modern-web.md` (native `<dialog>`, real table, 44 px touch targets, no color-only status, reduced motion, no HTML sinks).

**Plan, laptop.**
- Each category row shows its status pill (S1 to S7), the target icon (pie, check, Zz, calendar, card) with a text alternative, and optionally a thin progress bar.
- Checkbox per row and per group. The Inspector follows the selection (rules section 5).
- Working filter chips: All, Overspent, Underfunded, Overfunded, Money available, Snoozed. Auto-Assign and the month summary then apply to the visible categories.
- Toolbar: Undo, Redo, Recent Moves, plus the existing add group and add category.
- Ctrl+Z and Ctrl+Y (Cmd on Mac) run Undo and Redo, but never while a text field has focus.

**Inspector** (a drawer on tablet and a bottom sheet on phone). One category: Target section with the needed amount and due text ("₱3,000.00 more needed by the 1st"), Edit target, Snooze this month (only the current month; not for payment categories), Details, Set as current goal, Auto-Assign options for that category, the available breakdown, and Notes. Nothing selected: Cost to Be Me with an expected income field, Auto-Assign, "Available in [Month]" (left over, assigned, activity, available), and "Assigned in the Future" with a per-month breakdown and a red alert when a future Ready to Assign would be negative.

**Target editor** (native dialog): cadence switch (Weekly, Monthly, Yearly, Custom), amount (money input), behavior, the fields for that cadence (weekday; day of month or end of month; "By" month; custom "Due on" month and repeat), a plain-language summary of what it will ask each month, Save, and Delete. Show only valid combinations (rules 2.1).

**Auto-Assign preview** (native dialog): the option list (only options that apply), then a preview table of categories and amounts, Ready to Assign after, **Save assignments** and Cancel. The user may edit an amount in the preview. Reset Assigned asks for confirmation.

**Move Money** dialog: from, to, amount, Done. Banner "Cover N overspent categories" in the current month. Covering offers funded categories and Ready to Assign as sources.

**Recent Moves** sheet: last 34 days, filter All, Moved, Assigned, the icons from M6, "N categories" expands, a category name jumps to it, and an Undo button on the most recent move.

**Home.** Pinned card (exists) and the Current goal card: a progress ring ("73% Complete" style), Funded and To go, an Adjust button that opens the target editor. If no goal is set, a short prompt that says where to set one.

**Settings.** Add a Progress bars toggle. Keep the existing data tools.

**Phone.** Same features through sheets, with the five-tab bar and "+ Transaction" unchanged. Assign mode is the Auto-Assign preview sheet, opened from the Ready to Assign banner.

## 6. Golden scenarios (write these as tests first, amounts in pesos)

Today is October 2026 (`currentMonth` 2026-10). October 2026 has five Saturdays (3, 10, 17, 24, 31); November has four; December has four.

1. **T1 monthly set-aside 5,000.** Assigned 0 gives needed 5,000. Assign 3,000 gives 2,000. Assign 5,000 gives 0 (funded). Spend 2,000. November (carried 3,000, assigned 0) needs 5,000.
2. **T2 monthly refill 5,000.** Assign 5,000 in October and spend 3,500: October needed 0. November: carried 1,500, needed 3,500. Assign 3,500: funded. Spend 100: still funded. Viewed as a future month from October, November needs 5,000 whatever October left over.
3. **T3 weekly 1,000 on Saturday, set aside.** October needed 5,000. November 4,000. December 4,000.
4. **T5 custom 60,000 due 2027-09, set aside, no repeat.** October needs 5,000. Assign 5,000 in October, nothing in November: November needs 5,000, December needs 5,500. After September 2027 it needs 0.
5. **T5 custom 30,000 due 2027-03.** October slice is 5,000 (six months left).
6. **T8 balance 100,000, no due date.** With 30,000 available it needs 70,000, is not part of Underfunded, and shows green while Available is above 0.
7. **Z1 to Z5 snooze.** A snoozed 5,000 monthly target shows needed 0 and the Zz status, is skipped by Underfunded, and asks again in November. Snooze in a future month is refused.
8. **C1 to C4 Cost to Be Me.** Monthly 5,000, weekly Saturday 1,000 (five in October) and the 30,000 custom slice 5,000 total 15,000. Expected income 20,000 gives a margin of 5,000. The November total is 14,000, so no next-month line shows.
9. **A1 Underfunded order.** Ready to Assign 9,000. Rent monthly 5,000 due day 1; Internet monthly 1,500 due day 15; Fun monthly 2,000 end of month; Trip custom 12,000 due 2027-01 (slice 3,000). The preview assigns Rent 5,000, Internet 1,500, Fun 2,000, Trip 500, and Ready to Assign ends at 0. With Ready to Assign 20,000: Trip gets 3,000 and 8,500 is left.
10. **A1 tier 1.** Dining out is at -300 available with a 1,000 monthly set-aside target and nothing assigned. Underfunded assigns 1,000 in total, and Available ends at +700 (assumed).
11. **A3 and A4.** September assigned 4,000 and spent 2,500. "Assigned Last Month" sets October to 4,000. "Spent Last Month" sets it to 2,500.
12. **A5 and A6.** Assigned July 3,000, August 4,000, September 5,000: Average Assigned is 4,000. Spent 0, 1,000 and 2,000 in the same months, with assigning starting in July: Average Spent is 1,000. Months of 100.00, 100.00 and 101.00 average to 100.33 (nearest centavo).
13. **A7 Reduce Overfunding.** Monthly 5,000 set-aside with 6,000 assigned and 6,000 available: 1,000 goes back to Ready to Assign.
14. **A8 and A9.** Reset Available sends every positive Available back and can make Assigned negative. Reset Assigned sets Assigned to 0, only after confirmation.
15. **M1 to M4 moves.** Groceries has 800 available. Move 500 to Dining out: Groceries 300, Dining out +500, Ready to Assign unchanged. Cover 300 of Dining out overspending from Groceries. Undo restores both; Redo reapplies; a new move after an Undo clears Redo.
16. **Migration.** A version 1 database with accounts, transactions and assignments opens, migrates to version 2, and every row is still present. A v1 backup file imports into the new app.

## 7. Verification (before pushing)

- `pnpm verify` and `pnpm test:e2e` pass. Add Playwright flows for: creating a target of each cadence; the status and needed text; snoozing; Auto-Assign preview then save; Undo and Redo by button and by key; Move Money and cover; Recent Moves; the Home goal ring; a backup export and import round trip in both formats. Keep the axe and contrast checks green, in dark and light, at 375, 820 and 1280.
- No horizontal overflow at the same widths.
- Report which rows of the rules file are "assumed" and still untested against YNAB, and any rule you could not follow.

## 8. Commits

Separate Conventional Commits that you write yourself from the actual diff. Suggested order: versioned migrations and the new tables; engine targets with tests; engine Auto-Assign with tests; repository moves and Undo; backup v2; the target editor and status display; the Inspector; Auto-Assign preview; Move Money, cover and Recent Moves; Undo and Redo and shortcuts; Home goal ring; e2e. Work on `main` and push after the checks pass.
