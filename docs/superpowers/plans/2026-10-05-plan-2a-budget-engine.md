# Plan 2A: Budget Engine Implementation Plan

> **For Grok in Cursor:** Work through the tasks in order. Do not edit this plan file: keep your progress in the chat (tick steps there). Read `AGENTS.md`, the spec, `docs/guidance/modern-web.md`, `docs/guidance/commit-style.md` and this plan before starting. Do not run `git add`, `git commit` or `git push`. At every "Commit checkpoint", print the file list and a commit message that you write yourself from the actual diff (follow `docs/guidance/commit-style.md`; the plan's message is only a starting point), then stop and wait for the owner to commit. If a step's expected output does not match, stop and report the actual output instead of guessing. Every amount is an integer number of centavos.

**Prerequisite:** Plan 1 Tasks 1 and 2 are done (scaffold, `pnpm verify`, lint guardrails). Plan 2A touches only `src/engine/` and docs, so it can run while the rest of Plan 1 and Plan 0 are in progress.

**Goal:** Build the pure budget engine that reproduces YNAB's month math for cash accounts, credit cards and Ready to Assign, with golden tests taken from live YNAB.

**Architecture:** One pure function, `computeMonth(snapshot, month)`, walks months from the earliest data up to the requested month, computing each category's carry, assigned, activity, available and overspending, then Ready to Assign. A second pure function computes account balances. The engine imports nothing from the UI, storage, sync or DOM (lint enforces it) and takes only live records.

**Tech Stack:** TypeScript 6.0.3 strict, Vitest 5.0.3.

**Spec:** `docs/superpowers/specs/2026-10-05-kaban-design.md` (sections 3, 5 and 7). The rules are tracked in `docs/ynab-rulebook.md`, created in Task 1.

## Global Constraints

- The engine lives in `src/engine/`. It must not import React, `react-router`, or anything under `storage`, `sync`, `state`, `ui`, `features` or `app`, and must not use DOM globals. (Enforced by the Plan 1 lint rules.)
- Money is integer centavos. Any non-integer, `NaN`, infinite or unsafe-integer amount in the input makes `computeMonth` and `accountBalances` throw `RangeError`.
- Dates are `YYYY-MM-DD` strings and months are `YYYY-MM` strings (`MonthKey`). The engine never uses `Date`.
- Derived numbers are never stored. Soft-deleted records are filtered out by the caller before they reach the engine.
- Rule status labels: **verified** means checked in the live YNAB app on 2026-10-05; **documented** means taken from YNAB's support pages but not checked in the app; **assumed** means neither. Tests for documented and assumed rules are in a clearly named `describe` block and the rulebook lists how to verify them.
- Pin exact versions (no `^`, no `latest`). Commit messages follow Conventional Commits; the owner commits. Scope for this plan: `engine`, or `docs` for the rulebook.

## Review Focus

Failure modes the numbered steps do not exercise, most likely first. Each has a test in the task named.

1. A category spent with both cash and a credit card and then overspent: the split between cash and credit overspending decides whether next month's Ready to Assign drops (Task 4). Documented, not yet verified in the app.
2. Months with no activity between transactions: positive balances must carry, and a cash overspend must keep reducing every later month's Ready to Assign (Task 3).
3. Transactions on the last and first day of a month, and impossible dates such as `2026-02-29`, must land in the right month or be reported, never miscounted (Tasks 1 and 2).
4. Fractional, `NaN` or oversized amounts must never turn into wrong money silently (Task 2).
5. The same data in any input order must give identical results, and a large history must stay fast (Task 6).

## File structure

| File | Responsibility |
|---|---|
| `src/engine/months.ts` | `MonthKey` helpers: validation, month of a date, add, compare, range |
| `src/engine/types.ts` | Input and output types |
| `src/engine/compute.ts` | `computeMonth` and `accountBalances` |
| `src/engine/test-helpers.ts` | Builders for snapshots used only by tests |
| `src/engine/*.test.ts` | Unit, golden and property tests |
| `docs/ynab-rulebook.md` | The rule book with status and verification protocol |

---

### Task 1: Month helpers, types, and the rule book

**Files:**
- Create: `src/engine/months.ts`, `src/engine/types.ts`, `docs/ynab-rulebook.md`
- Test: `src/engine/months.test.ts`

**Interfaces:**
- Produces (`months.ts`): `type MonthKey = string`; `isMonthKey(s: string): boolean`; `monthOfDate(date: string): MonthKey | null`; `addMonths(m: MonthKey, n: number): MonthKey`; `compareMonths(a: MonthKey, b: MonthKey): number` (negative, zero or positive); `monthRange(from: MonthKey, to: MonthKey): MonthKey[]` (inclusive; empty when `from` is after `to`).
- Produces (`types.ts`):
  ```ts
  export interface EngineAccount { id: string; kind: 'cash' | 'credit' }
  export interface EngineCategory { id: string; kind: 'normal' | 'credit_card_payment'; cardAccountId?: string }
  export type EngineTransaction =
    | { id: string; accountId: string; date: string; kind: 'inflow'; amount: number }
    | { id: string; accountId: string; date: string; kind: 'categorized'; categoryId: string; amount: number }
    | { id: string; accountId: string; date: string; kind: 'transfer'; toAccountId: string; amount: number }
    | { id: string; accountId: string; date: string; kind: 'uncategorized'; amount: number }
  export interface AssignmentEntry { categoryId: string; month: MonthKey; delta: number }
  export interface BudgetSnapshot { accounts: EngineAccount[]; categories: EngineCategory[]; transactions: EngineTransaction[]; assignments: AssignmentEntry[] }
  export interface CategoryMonth { categoryId: string; carried: number; assigned: number; cashActivity: number; creditActivity: number; activity: number; available: number; cashOverspending: number; creditOverspending: number }
  export interface MonthSummary { leftOver: number; assigned: number; activity: number; available: number; assignedInFuture: number }
  export interface EngineWarning { code: 'unknown_category' | 'unknown_account' | 'invalid_date' | 'unsupported'; transactionId: string; message: string }
  export interface MonthView { month: MonthKey; readyToAssign: number; categories: Record<string, CategoryMonth>; summary: MonthSummary; warnings: EngineWarning[] }
  ```
  Sign conventions: `inflow.amount` is positive money entering Ready to Assign (a cash account starting balance is an inflow). `categorized.amount` is signed: spending is negative, a refund is positive. `transfer.amount` is positive and moves money from `accountId` to `toAccountId`. `uncategorized.amount` is signed and only affects the account balance (a credit card starting balance of -5000 is one). A credit card balance is negative when money is owed. For a category, `activity` and `cashActivity`/`creditActivity` keep spending negative; for a credit card payment category `activity` is positive for covered card spending and negative for payments.

- [ ] **Step 1: Write the failing tests** `src/engine/months.test.ts`: `monthOfDate('2026-10-31')` is `'2026-10'`; `'2026-11-01'` is `'2026-11'`; `'2028-02-29'` is `'2028-02'`; `null` for `'2026-02-29'`, `'2026-13-01'`, `'2026-10-5'`, `'10/05/2026'`, `''`, `'2026-04-31'`; `isMonthKey('2026-10')` true and false for `'2026-00'`, `'2026-13'`, `'26-10'`, `'2026-10-05'`; `addMonths('2026-12', 1)` is `'2027-01'`; `addMonths('2026-01', -1)` is `'2025-12'`; `addMonths('2026-10', 14)` is `'2027-12'`; `addMonths('2026-10', -22)` is `'2024-12'`; `compareMonths('2026-10', '2026-11')` is negative, reversed positive, equal zero, and `compareMonths('2025-12', '2026-01')` is negative; `monthRange('2026-11', '2027-02')` is `['2026-11','2026-12','2027-01','2027-02']`; `monthRange('2026-10', '2026-10')` is `['2026-10']`; `monthRange('2026-11', '2026-10')` is `[]`.
- [ ] **Step 2: Run to see it fail.** Run `pnpm test src/engine/months.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `months.ts` and `types.ts`** as specified. `monthOfDate` validates with a regular expression and integer leap-year logic (a year is a leap year when divisible by 4 and not by 100, or divisible by 400). No `Date`.
- [ ] **Step 4: Create `docs/ynab-rulebook.md`** with a table of rules and a verification protocol. Columns: id, rule, status, evidence. Rows (exact):
  | id | rule | status |
  |---|---|---|
  | R1 | `readyToAssign(m) = readyToAssign(m-1) + inflows(m) - assigned(m) - cashOverspending(m-1)`, with `readyToAssign` zero before the first month | verified for current-month behavior (G1, G2, G3) |
  | R1b | Assignments to a future month reduce Ready to Assign only from that month on; the current month's Ready to Assign is not reduced by them; they are reported in `assignedInFuture` | documented, not verified in the app |
  | R1c | Income dated in a later month counts from that month on | documented, not verified in the app |
  | R2 | `available(c,m) = carried(c,m) + assigned(c,m) + activity(c,m)`, `carried(c,m) = max(0, available(c,m-1))` | verified |
  | R3 | Cash overspending resets next month and is deducted from next month's Ready to Assign | verified (G3) |
  | R4 | Credit overspending resets next month and does not change Ready to Assign; the unfunded amount stays as card debt | verified (G4) |
  | R4b | In a category with both cash and credit spending, cash is taken out first: `cashOverspending = max(0, cashSpend - funds)`; credit is covered by what is left; `creditOverspending = max(0, creditSpend - max(0, funds - cashSpend))` | documented, not verified in the app |
  | R5 | Covered credit spending moves to the card's payment category: `moved = creditSpend - creditOverspending`, allocated across cards in transaction date then id order | verified for one card (G4); multi-card allocation assumed |
  | R5b | A payment (transfer from a cash account to the card) reduces the payment category's activity | documented, not verified in the app |
  | R5c | A payment category with negative available is cash overspending (it resets next month and is deducted from Ready to Assign) | assumed (YNAB shows it red) |
  | R6 | Month summary: `leftOver = Σ carried`, `assigned = Σ assigned`, `activity = Σ activity`, `available = Σ available`, over every category including payment categories | verified (October figures: 0, 4,000.00, -3,700.00, 300.00) |
  | R7 | Account balance is the sum of signed amounts; a transfer subtracts from the source and adds to the destination | verified |
  Add a section **Verification protocol** for R1b, R1c, R4b, R5b, R5c with the experiment and the expected numbers from Tasks 3 and 4, to be run in the "Kaban Test" plan in YNAB by the owner or Claude; if YNAB disagrees, change the rule, the test and the code together.
- [ ] **Step 5: Run the tests.** Run `pnpm test src/engine/months.test.ts && pnpm verify`. Expected: PASS.
- [ ] **Step 6: Commit checkpoint.** Files: `src/engine/months.ts`, `src/engine/types.ts`, `src/engine/months.test.ts`, `docs/ynab-rulebook.md`. Message:
  ```
  feat(engine): add month helpers, engine types, and the ynab rule book

  - add pure month key helpers with calendar-correct date validation
  - define engine input and output types with explicit sign conventions
  - add a rule book that labels each rule verified, documented, or assumed
  - cover month boundaries, leap days, and invalid dates with Vitest
  ```

### Task 2: Core month math for cash accounts (G1 and G2)

**Files:**
- Create: `src/engine/compute.ts`, `src/engine/test-helpers.ts`
- Test: `src/engine/compute.core.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces (`compute.ts`): `computeMonth(snapshot: BudgetSnapshot, month: MonthKey): MonthView`; `accountBalances(snapshot: BudgetSnapshot, throughDate?: string): Record<string, number>`.
- Produces (`test-helpers.ts`): `cash(id: string): EngineAccount`; `card(id: string): EngineAccount`; `normal(id: string): EngineCategory`; `payment(id: string, cardAccountId: string): EngineCategory`; `inflow(id: string, accountId: string, date: string, amount: number): EngineTransaction`; `spend(id: string, accountId: string, date: string, categoryId: string, amount: number): EngineTransaction` (`amount` positive; stored negative); `refund(id: string, accountId: string, date: string, categoryId: string, amount: number): EngineTransaction` (stored positive); `pay(id: string, fromAccountId: string, toCardId: string, date: string, amount: number): EngineTransaction`; `plain(id: string, accountId: string, date: string, amount: number): EngineTransaction` (uncategorized, signed); `assign(categoryId: string, month: MonthKey, delta: number): AssignmentEntry`; `snap(parts: Partial<BudgetSnapshot>): BudgetSnapshot` (missing arrays default to empty).

- [ ] **Step 1: Write the failing tests** in `compute.core.test.ts` (amounts in centavos; wallet is `cash('wallet')`, categories `normal('groc')` and `normal('dine')`):
  - **G1** `a 10,000.00 starting balance gives Ready to Assign 10,000.00`: `inflow('s','wallet','2026-10-05',1_000_000)`; `computeMonth(..., '2026-10').readyToAssign` is `1_000_000`; `accountBalances` for `wallet` is `1_000_000`.
  - **G2** `assigning lowers Ready to Assign and sets Available`: plus `assign('groc','2026-10',300_000)` and `assign('dine','2026-10',100_000)`: `readyToAssign` is `600_000`; `categories.groc.available` is `300_000`; `categories.dine.available` is `100_000`; `categories.groc.assigned` is `300_000`.
  - `assignment entries sum`: two entries for `groc` in the same month of `+300_000` and `-50_000` give `assigned` `250_000`.
  - `spending reduces Available and shows negative activity`: spend 50_000 from `wallet` on `groc` (assigned 300_000): `activity` `-50_000`, `cashActivity` `-50_000`, `creditActivity` `0`, `available` `250_000`; Ready to Assign unchanged.
  - `positive Available carries to the next month`: assigned 300_000 in October, nothing in November: November `carried` is `300_000`, `assigned` `0`, `available` `300_000`; November Ready to Assign equals October's.
  - `a cash refund adds to Available`: assigned 100_000, spend 30_000, refund 10_000: `activity` `-20_000`, `available` `80_000`.
  - `months before the first data are empty`: `computeMonth(..., '2026-09')` has `readyToAssign` `0` and every category `available` `0`.
  - `month boundaries`: spend on `2026-10-31` counts in October only; spend on `2026-11-01` counts in November only.
  - `Review Focus 4 (non-integer amounts throw)`: for amounts `1.5`, `NaN`, `Infinity`, `-Infinity`, `2 ** 53`, an `inflow` and a `spend` and an `assign` each make `computeMonth` throw `RangeError`; `accountBalances` throws too.
  - `warnings`: a `spend` with an unknown category gives one warning `unknown_category` and does not change any category; a transaction in an unknown account gives `unknown_account`; a date `2026-02-29` gives `invalid_date`; none of these throw, and none change Ready to Assign.
  - `account balances`: inflow 1_000_000, spend 350_000, plain -50_000 on a card, and a `pay` of 20_000 from the wallet to that card give wallet `630_000` and card `-30_000`; `throughDate: '2026-10-10'` ignores later transactions.
- [ ] **Step 2: Run to see failures.** Run `pnpm test src/engine/compute.core.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `computeMonth` for this scope** in `compute.ts`. Approach: validate every amount first (`Number.isSafeInteger`, throw `RangeError` naming the record id); index transactions and assignments by month once; find the earliest month among valid data; iterate `monthRange(earliest, month)`; per category compute `carried`, `assigned`, `cashActivity`, `creditActivity`, `activity`, `available` per R2; compute `readyToAssign` per R1; fill `summary` per R6 (with `assignedInFuture` summed over assignments in months after `month`). Transactions that fail validation produce warnings and are skipped for budget math. Credit and payment-category behavior comes in Task 4; here `creditActivity` is only a sum. Implement `accountBalances` per R7.
- [ ] **Step 4: Run the tests and `pnpm verify`.** Expected: PASS.
- [ ] **Step 5: Commit checkpoint.** Files: `src/engine/compute.ts`, `test-helpers.ts`, `compute.core.test.ts`. Message:
  ```
  feat(engine): add core month math, ready to assign, and account balances

  - compute carry, assigned, activity, available, and ready to assign per month
  - report unknown references and invalid dates as warnings and reject non-integer amounts
  - cover the verified starting balance and assignment scenarios with Vitest
  ```

### Task 3: Cash overspending and its effect on Ready to Assign (G3)

**Files:**
- Modify: `src/engine/compute.ts`
- Test: `src/engine/compute.cash-overspend.test.ts`

**Interfaces:**
- Consumes: Task 2 helpers and `computeMonth`.
- Produces: `CategoryMonth.cashOverspending` for normal categories per R3 and the Ready to Assign deduction per R1.

- [ ] **Step 1: Write the failing tests** (October is `2026-10`; assigned 300_000 to `groc`, 100_000 to `dine`, a 1_000_000 inflow, so October Ready to Assign is 600_000):
  - **G3** `cash overspending resets next month and lowers next month's Ready to Assign`: spend 350_000 from the wallet on `groc` in October. October: `groc.available` `-50_000`, `groc.cashOverspending` `50_000`, `readyToAssign` `600_000` (unchanged). November: `groc.carried` `0`, `groc.available` `0`, `readyToAssign` `550_000`.
  - `the deduction persists in later months` (Review Focus 2): with no data in November, December and January, `readyToAssign` is `550_000` in each; a positive `dine` balance of 100_000 carries unchanged to January.
  - `assigning after an overspend is fresh money`: add `assign('groc','2026-11',50_000)`: November `groc.available` `50_000` (not `0`), November `readyToAssign` `500_000`.
  - `a cash refund while overspent`: assigned 0, spend 50_000, refund 20_000 in October: `available` `-30_000`, `cashOverspending` `30_000`.
  - `two overspent categories deduct the sum`: spending 20_000 over in two categories lowers November Ready to Assign by 40_000.
  - `an exactly spent category is not overspent`: spend 300_000 on `groc` (assigned 300_000): `available` `0`, `cashOverspending` `0`, November Ready to Assign equals October's.
- [ ] **Step 2: Run to see failures.** Run `pnpm test src/engine/compute.cash-overspend.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `cashOverspending` and `carried = max(0, previous available)` (the carry rule already resets negatives), and the `- cashOverspending(m-1)` term of R1. Cash overspending for a normal category is `max(0, cashSpend - fundsForSpend)` where `cashSpend = max(0, -cashActivity)` and `fundsForSpend = carried + assigned + max(0, cashActivity)`.
- [ ] **Step 4: Run the tests and `pnpm verify`.** Expected: PASS.
- [ ] **Step 5: Commit checkpoint.** Files: `src/engine/compute.ts`, `compute.cash-overspend.test.ts`. Message:
  ```
  feat(engine): add cash overspending and the ready to assign deduction

  - reset a negative available balance next month and deduct the cash shortfall from ready to assign
  - keep the deduction for every later month, including months with no activity
  - cover the verified overspend scenario, refunds, and fresh assignments after an overspend
  ```

### Task 4: Credit cards: payment categories, credit overspending, payments (G4)

**Files:**
- Modify: `src/engine/compute.ts`
- Test: `src/engine/compute.credit.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3. Test accounts: `cash('wallet')`, `card('cardA')`, `card('cardB')`; categories `normal('groc')`, `normal('dine')`, `payment('payA','cardA')`, `payment('payB','cardB')`.
- Produces: `CategoryMonth.creditOverspending`, payment-category `activity` and `available` per R5, R5b and R5c.

- [ ] **Step 1: Write the failing tests.** Common setup: inflow 1_000_000 to the wallet in October, `assign('groc','2026-10',300_000)`, `assign('dine','2026-10',100_000)`.
  - **G4** `credit overspending is not deducted from Ready to Assign`: spend 350_000 from the wallet on `groc` (as in G3) and 120_000 on `cardA` for `dine`. October: `dine.available` `-20_000`, `dine.creditOverspending` `20_000`, `dine.cashOverspending` `0`, `dine.creditActivity` `-120_000`, `payA.activity` `100_000`, `payA.available` `100_000`, `readyToAssign` `600_000`. Summary: `leftOver` `0`, `assigned` `400_000`, `activity` `-370_000`, `available` `30_000`. November: `dine.available` `0`, `payA.carried` `100_000`, `payA.available` `100_000`, `readyToAssign` `550_000` (only the groceries cash overspend is deducted). Account balances: wallet `650_000`, `cardA` `-120_000`.
  - `fully covered card spending`: spend 60_000 on `cardA` for `dine`: `dine.available` `40_000`, `creditOverspending` `0`, `payA.activity` `60_000`.
  - `a payment reduces the payment category (R5b, documented)`: add `pay('p1','wallet','cardA','2026-10-20',30_000)`: `payA.activity` `30_000`, `payA.available` `30_000`; wallet balance `-30_000` relative to before; `cardA` balance `-30_000`. A full payment of 60_000 gives `payA.available` `0` and card balance `0`.
  - `payment with no card spending`: paying 20_000 with nothing moved: `payA.available` `-20_000`.
  - `overpaying is cash overspending (R5c, assumed)`: payment 80_000 against 60_000 moved: `payA.available` `-20_000`, `payA.cashOverspending` `20_000`; November `payA.available` `0` and `readyToAssign` lower by 20_000 than October's.
  - `two cards, not enough funds` (R5 multi-card, assumed order by date then id): `dine` assigned 100_000; spend 70_000 on `cardA` on `2026-10-01` and 70_000 on `cardB` on `2026-10-02`: `dine.available` `-40_000`, `creditOverspending` `40_000`, `payA.activity` `70_000`, `payB.activity` `30_000`.
  - `Review Focus 1` in `describe('documented but not yet verified in the app (R4b)')`: (a) assigned 100_000; wallet spend 80_000 and `cardA` spend 60_000 in the same category: `cashOverspending` `0`, `creditOverspending` `40_000`, `payA.activity` `20_000`, `available` `-40_000`, November Ready to Assign equals October's. (b) assigned 50_000; wallet spend 80_000 and `cardA` spend 60_000: `cashOverspending` `30_000`, `creditOverspending` `60_000`, `payA.activity` `0`, `available` `-90_000`, November Ready to Assign is October's minus 30_000.
  - `a credit card starting balance does not touch the budget`: `plain('d','cardA','2026-10-01',-50_000)`: card balance `-50_000`, Ready to Assign and every category unchanged.
  - `credit refunds are unsupported`: a `refund` on `cardA` gives warning code `unsupported`, leaves the category unchanged, and still changes the card balance by the signed amount.
  - `a category with credit spending but no payment category for that card`: warning `unknown_category`; the category's own numbers still use R4 with no movement.
- [ ] **Step 2: Run to see failures.** Run `pnpm test src/engine/compute.credit.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** per rules R4, R4b, R5, R5b, R5c. Approach: for each normal category and month, first compute cash overspending (Task 3), then `remainingAfterCash = max(0, fundsForSpend - cashSpend)`, then walk the category's credit transactions in `(date, id)` order, covering each from `remainingAfterCash` until it is exhausted; the uncovered remainder sums to `creditOverspending` and each card's covered sum is moved to that card's payment category. A payment category's `activity` is the moved total minus payments (transfers whose destination is the card and whose source is a cash account); its overspending is cash overspending, included in R1's deduction. Transfers between two cash accounts do nothing to the budget. Transfers from a credit account are `unsupported` warnings.
- [ ] **Step 4: Run the tests and `pnpm verify`.** Expected: PASS.
- [ ] **Step 5: Commit checkpoint.** Files: `src/engine/compute.ts`, `compute.credit.test.ts`. Message:
  ```
  feat(engine): add credit card payment categories and credit overspending

  - move covered card spending into each card's payment category by date order
  - keep credit overspending out of ready to assign and treat overpaying as cash overspending
  - attribute mixed cash and credit spending with cash taken first
  - cover the verified credit scenario and label documented and assumed rules in tests
  ```

### Task 5: Month summary and future assignments

**Files:**
- Modify: `src/engine/compute.ts`
- Test: `src/engine/compute.summary.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 4.
- Produces: `MonthView.summary` per R6 and `assignedInFuture` per R1b.

- [ ] **Step 1: Write the failing tests.** Reuse the G3 and G4 data. October summary equals `leftOver 0`, `assigned 400_000`, `activity -370_000`, `available 30_000`. November summary (no new activity): `leftOver` equals the October positive carries (`100_000` from `payA` plus `250_000`... compute from the data: `dine` and `groc` reset to 0, so `leftOver` is `100_000`), `assigned 0`, `activity 0`, `available 100_000`. `describe('documented (R1b, R1c)')`: with `assign('dine','2026-11',100_000)` added, October `readyToAssign` is unchanged, October `summary.assignedInFuture` is `100_000`, and November `readyToAssign` is `550_000 - 100_000`. With an `inflow` of 500_000 dated `2026-11-10`, October `readyToAssign` is unchanged and November's is higher by 500_000. A snapshot with no categories returns a summary of all zeros and `readyToAssign` equal to the inflows.
- [ ] **Step 2: Run to see failures.** Run `pnpm test src/engine/compute.summary.test.ts`. Expected: FAIL for the future-month parts only (the summary may already pass from Task 2).
- [ ] **Step 3: Implement** the remaining parts.
- [ ] **Step 4: Run the tests and `pnpm verify`.** Expected: PASS.
- [ ] **Step 5: Commit checkpoint.** Files: `src/engine/compute.ts`, `compute.summary.test.ts`. Message:
  ```
  feat(engine): add month summary and future month assignments

  - sum left over, assigned, activity, and available across all categories including payments
  - report assignments in later months separately and keep them out of the current month's ready to assign
  - count income dated in a later month only from that month on
  ```

### Task 6: Invariants, determinism, and performance

**Files:**
- Test: `src/engine/compute.properties.test.ts`
- Modify: `src/engine/compute.ts` only if a test exposes a bug

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the invariant tests.** Add a small seeded pseudo-random generator in the test file (a 32-bit linear congruential generator; seeds 1 to 200). Each seed builds a snapshot with 2 cash accounts, 2 cards, 5 normal categories, 2 payment categories, and 30 random transactions across 2026-08 to 2027-01 (inflows, cash spending, card spending, cash refunds, payments, cash-to-cash transfers, uncategorized card balances) and random assignments. For every month `m` in the range, filter the snapshot to transactions dated up to the last day of `m` and assignments in months up to `m`, then assert the **cash identity** `sum(accountBalances for cash accounts) === readyToAssign(m) + sum(category.available) + sum(category.creditOverspending)` for the month. (Derivation: Ready to Assign plus all Available plus this month's credit overspending equals total cash, because credit overspending is the only negative Available that did not come out of cash.) Also assert for every category and month: `available === carried + assigned + activity`; `carried >= 0`; `cashOverspending >= 0` and `creditOverspending >= 0`; `activity === cashActivity + creditActivity` for normal categories.
- [ ] **Step 2: Write the determinism and performance tests.** `input order does not matter` (Review Focus 5): for 20 seeds, shuffle `transactions`, `assignments`, `categories` and `accounts` with the same generator and assert `computeMonth` returns a deeply equal result for a fixed month. `computeMonth` is a pure function: calling it twice returns equal results and does not mutate its input (deep-freeze the snapshot in the test). `a large history stays fast`: 10,000 transactions over 60 months and 40 categories; `computeMonth` for the last month finishes in under 500 ms (record the measured time in the commit body); the test fails if it exceeds that bound.
- [ ] **Step 3: Run them.** Run `pnpm test src/engine/compute.properties.test.ts`. Expected: either PASS or a failing seed. A failing seed is a real engine bug: print the seed and month, fix `compute.ts`, and re-run. If the identity fails on credit refunds or credit-account transfers, confirm the generator excludes those unsupported cases rather than weakening the identity.
- [ ] **Step 4: Run everything.** Run `pnpm verify`. Expected: PASS, with the engine boundary lint clean (the engine imports nothing outside `src/engine`).
- [ ] **Step 5: Update `docs/ynab-rulebook.md`** so every rule's status matches the tests, and list any rule you had to change during Task 6.
- [ ] **Step 6: Commit checkpoint.** Files: `src/engine/compute.properties.test.ts`, `docs/ynab-rulebook.md`, and `src/engine/compute.ts` if changed. Message:
  ```
  test(engine): add cash identity, determinism, and performance property tests

  - assert the cash identity across 200 seeded random budgets for every month
  - assert input order independence and that the engine does not mutate its input
  - guard against quadratic slowdowns with a 10,000 transaction history
  ```

## Self-review notes

- Spec coverage: rules R1 to R5 (spec section 5) and golden scenarios G1 to G4 (spec section 7) are Tasks 2 to 4; the verified October summary is Task 4 and Task 5; engine purity and integer money (spec section 3) are enforced by Plan 1 lint rules and Task 2's `RangeError` tests. Not here, by design: targets and Auto-Assign (Plan 3), splits and scheduled transactions (Plan 5), loans and tracking accounts (Plan 4), storage and screens (Plan 2B).
- Types are defined once in `types.ts` (Task 1) and reused unchanged. `test-helpers.ts` names (`cash`, `card`, `normal`, `payment`, `inflow`, `spend`, `refund`, `pay`, `plain`, `assign`, `snap`) are used identically in Tasks 2 to 6.
- The November summary figure in Task 5 is `100_000` leftOver and `100_000` available: only `payA` keeps a positive balance after the groceries and dining resets.
