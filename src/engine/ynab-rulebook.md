# YNAB rule book (Kaban engine)

Status labels:

- **verified** — checked in the live YNAB app on 2026-10-05
- **documented** — taken from YNAB support pages but not checked in the app
- **assumed** — neither verified nor documented; tests live in a clearly named `describe` block

Amounts are integer centavos. Soft-deleted records are filtered out before they reach the engine.

## Rules

| id  | rule                                                                                                                                                                                                                                 | status                                                     | evidence                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| R1  | `readyToAssign(m) = readyToAssign(m-1) + inflows(m) - assigned(m) - cashOverspending(m-1)`, with `readyToAssign` zero before the first month                                                                                         | verified for current-month behavior (G1, G2, G3)           | golden G1–G3; `compute.core.test.ts`, `compute.cash-overspend.test.ts`               |
| R1b | Assignments to a future month reduce Ready to Assign only from that month on; the current month's Ready to Assign is not reduced by them; they are reported in `assignedInFuture`                                                    | documented, not verified in the app                        | `compute.summary.test.ts` describe `documented (R1b, R1c)`                           |
| R1c | Income dated in a later month counts from that month on                                                                                                                                                                              | documented, not verified in the app                        | `compute.summary.test.ts` describe `documented (R1b, R1c)`                           |
| R2  | `available(c,m) = carried(c,m) + assigned(c,m) + activity(c,m)`, `carried(c,m) = max(0, available(c,m-1))`                                                                                                                           | verified                                                   | G2–G4; core and overspend tests                                                      |
| R3  | Cash overspending resets next month and is deducted from next month's Ready to Assign                                                                                                                                                | verified (G3)                                              | `compute.cash-overspend.test.ts`                                                     |
| R4  | Credit overspending resets next month and does not change Ready to Assign; the unfunded amount stays as card debt                                                                                                                    | verified (G4)                                              | `compute.credit.test.ts`                                                             |
| R4b | In a category with both cash and credit spending, cash is taken out first: `cashOverspending = max(0, cashSpend - funds)`; credit is covered by what is left; `creditOverspending = max(0, creditSpend - max(0, funds - cashSpend))` | documented, not verified in the app                        | `compute.credit.test.ts` describe `documented but not yet verified in the app (R4b)` |
| R5  | Covered credit spending moves to the card's payment category: `moved = creditSpend - creditOverspending`, allocated across cards in transaction date then id order                                                                   | verified for one card (G4); multi-card allocation assumed  | G4; multi-card case in `compute.credit.test.ts`                                      |
| R5b | A payment (transfer from a cash account to the card) reduces the payment category's activity                                                                                                                                         | documented, not verified in the app                        | `compute.credit.test.ts` payment cases                                               |
| R5c | A payment category with negative available is cash overspending (it resets next month and is deducted from Ready to Assign)                                                                                                          | assumed (YNAB shows it red)                                | `compute.credit.test.ts` overpaying case                                             |
| R6  | Month summary: `leftOver = Σ carried`, `assigned = Σ assigned`, `activity = Σ activity`, `available = Σ available`, over every category including payment categories                                                                 | verified (October figures: 0, 4,000.00, -3,700.00, 300.00) | G4 summary; `compute.summary.test.ts`                                                |
| R7  | Account balance is the sum of signed amounts; a transfer subtracts from the source and adds to the destination                                                                                                                       | verified                                                   | `compute.core.test.ts` account balances                                              |

## Targets, Auto-Assign, moves (Milestone A)

Copied from `docs/superpowers/specs/2026-10-06-ynab-targets-autoassign-rules.md`. Assumed rows are tested under `describe('assumed (...)')`.

| id | rule | status | evidence |
| --- | --- | --- | --- |
| T1 | monthly set_aside: `needed = max(0, T - assigned)` | documented | `milestone-a.golden.test.ts` |
| T2 | monthly refill: current/past uses carried+assigned; future ignores leftover | documented | golden T2 |
| T3 | weekly set_aside: `T * n(weekday)` | documented | golden T3 |
| T4 | weekly refill with T2 future-month rule | documented | (same helpers as T2/T3) |
| T5 | yearly/custom set_aside slice with catch-up when a month is skipped | assumed (catch-up) | `assumed (T5 custom set-aside catch-up)` |
| T6 | yearly/custom refill / fill-up uses available | assumed | helpers in `targets.ts` |
| T7 | custom balance with due month same as T6 | assumed | helpers in `targets.ts` |
| T8 | custom balance no due: `max(0, T - carried - assigned)`; not in Underfunded; green when available > 0 | documented | golden T8 |
| T9 | refunds in current month do not count toward targets | documented | targets ignore activity |
| S1–S7 | overspent, credit overspent, underfunded, funded, snoozed, positive, zero | documented | `computeTargets` status |
| Z1–Z5 | snooze clears needed, lasts one month, current month only, skipped by Underfunded, no CC snooze | documented | golden Z |
| Z6 | snooze stored per category+month | design | storage |
| C1–C4 | Cost to Be Me full asks, expected income, margin, next month when higher | C2 past / C3 margin assumed | golden C |
| A1 | Underfunded order tiers 1–4 (tier 2 scheduled and tier 5 cards: Milestone B) | order documented; tier 1 amount assumed | golden A1; `assumed (A1 tier 1…)` |
| A2 | selected Underfunded may drive Ready to Assign negative | documented | `autoAssign.ts` scope |
| A3–A4 | Assigned/Spent Last Month replace assigned | replace assumed | `assumed (A3 A4…)` |
| A5–A6 | averages over up to 12 prior months; nearest centavo half-up | rounding assumed | `assumed (A5 A6…)` |
| A7 | Reduce Overfunding excess formula | excess assumed | `assumed (A7…)` |
| A8 | Reset Available: positive Available only | positive-only assumed | `assumed (A8…)` |
| A9 | Reset Assigned to 0 | documented | golden A9 |
| M1–M4 | Move Money, cover, Undo/Redo | M2 available limit and M4 web scope assumed | golden M; repo Undo later |

## Task 6 property checks

Cash identity, input-order independence, purity, and a 10,000-transaction history check live in `compute.properties.test.ts`. Auto-Assign / move cash identity and Undo math live in `autoAssign.properties.test.ts`.
