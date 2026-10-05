# YNAB rule book (Kaban engine)

Status labels:

- **verified** — checked in the live YNAB app on 2026-10-05
- **documented** — taken from YNAB support pages but not checked in the app
- **assumed** — neither verified nor documented; tests live in a clearly named `describe` block

Amounts are integer centavos. Soft-deleted records are filtered out before they reach the engine.

## Rules

| id | rule | status | evidence |
|---|---|---|---|
| R1 | `readyToAssign(m) = readyToAssign(m-1) + inflows(m) - assigned(m) - cashOverspending(m-1)`, with `readyToAssign` zero before the first month | verified for current-month behavior (G1, G2, G3) | golden G1–G3; `compute.core.test.ts`, `compute.cash-overspend.test.ts` |
| R1b | Assignments to a future month reduce Ready to Assign only from that month on; the current month's Ready to Assign is not reduced by them; they are reported in `assignedInFuture` | documented, not verified in the app | `compute.summary.test.ts` describe `documented (R1b, R1c)` |
| R1c | Income dated in a later month counts from that month on | documented, not verified in the app | `compute.summary.test.ts` describe `documented (R1b, R1c)` |
| R2 | `available(c,m) = carried(c,m) + assigned(c,m) + activity(c,m)`, `carried(c,m) = max(0, available(c,m-1))` | verified | G2–G4; core and overspend tests |
| R3 | Cash overspending resets next month and is deducted from next month's Ready to Assign | verified (G3) | `compute.cash-overspend.test.ts` |
| R4 | Credit overspending resets next month and does not change Ready to Assign; the unfunded amount stays as card debt | verified (G4) | `compute.credit.test.ts` |
| R4b | In a category with both cash and credit spending, cash is taken out first: `cashOverspending = max(0, cashSpend - funds)`; credit is covered by what is left; `creditOverspending = max(0, creditSpend - max(0, funds - cashSpend))` | documented, not verified in the app | `compute.credit.test.ts` describe `documented but not yet verified in the app (R4b)` |
| R5 | Covered credit spending moves to the card's payment category: `moved = creditSpend - creditOverspending`, allocated across cards in transaction date then id order | verified for one card (G4); multi-card allocation assumed | G4; multi-card case in `compute.credit.test.ts` |
| R5b | A payment (transfer from a cash account to the card) reduces the payment category's activity | documented, not verified in the app | `compute.credit.test.ts` payment cases |
| R5c | A payment category with negative available is cash overspending (it resets next month and is deducted from Ready to Assign) | assumed (YNAB shows it red) | `compute.credit.test.ts` overpaying case |
| R6 | Month summary: `leftOver = Σ carried`, `assigned = Σ assigned`, `activity = Σ activity`, `available = Σ available`, over every category including payment categories | verified (October figures: 0, 4,000.00, -3,700.00, 300.00) | G4 summary; `compute.summary.test.ts` |
| R7 | Account balance is the sum of signed amounts; a transfer subtracts from the source and adds to the destination | verified | `compute.core.test.ts` account balances |

## Verification protocol

Run these in the "Kaban Test" plan in YNAB. If YNAB disagrees, change the rule, the test, and the code together.

### R1b — future assignments

1. Starting balance 10,000.00 in October. Assign 3,000.00 to Groceries and 1,000.00 to Dining out in October.
2. Assign 1,000.00 to Dining out in November (from the October screen / future month).
3. Expected: October Ready to Assign stays 6,000.00; October shows 1,000.00 assigned in future; November Ready to Assign is 5,500.00 − 1,000.00 = 4,500.00 after the groceries cash overspend from G3, or 6,000.00 − 1,000.00 without overspend.

### R1c — income in a later month

1. Same October setup as G2 (Ready to Assign 6,000.00).
2. Add an inflow of 5,000.00 dated November 10.
3. Expected: October Ready to Assign unchanged; November Ready to Assign higher by 5,000.00.

### R4b — mixed cash and credit overspending

**(a)** Assigned 1,000.00. Wallet spend 800.00 and card spend 600.00 in the same category.

- Expected: `cashOverspending` 0, `creditOverspending` 400.00, payment category activity 200.00, available −400.00; next month's Ready to Assign equals this month's.

**(b)** Assigned 500.00. Wallet spend 800.00 and card spend 600.00.

- Expected: `cashOverspending` 300.00, `creditOverspending` 600.00, payment category activity 0, available −900.00; next month's Ready to Assign is this month's minus 300.00.

### R5b — payment reduces payment category

1. Covered card spending of 600.00 moves 600.00 into the payment category.
2. Pay 300.00 from cash to the card.
3. Expected: payment category activity 300.00, available 300.00; cash balance down 300.00; card balance up 300.00 (less debt).

### R5c — overpaying is cash overspending

1. Covered card spending of 600.00; pay 800.00.
2. Expected: payment category available −200.00 and cash overspending 200.00; next month payment category 0 and Ready to Assign lower by 200.00.
