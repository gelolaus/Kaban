# YNAB rules for Milestone A: targets, Auto-Assign, moving money

Date: 2026-10-06
Status: Draft. Read from YNAB's own help pages on 2026-10-06. Nothing here is checked in the live YNAB app yet, except where a row says so.

This extends the rule book in `docs/superpowers/specs/2026-10-05-kaban-design.md` section 5 (R1 to R7). The coding agent copies these rows into `src/engine/ynab-rulebook.md` and keeps the same status labels:

- **documented**: taken from a YNAB help page listed under Sources. Not checked in the app.
- **assumed**: the help pages do not give the exact rule. The row says what Kaban does until it is checked. Tests for these live in a `describe` block named `assumed (...)`, so one table change fixes them.
- **verified**: checked in the live app by the owner (none yet; see the verification protocol at the end).

All amounts are integer centavos. Examples below use pesos for readability.

## 1. Vocabulary

- **Current month**: the month of today's date. The engine is pure, so the caller passes it in as `currentMonth`. It is never read from a clock inside `src/engine/`.
- **Future month**: any month after the current month. Past month: before it.
- `carried(c,m)`, `assigned(c,m)`, `activity(c,m)`, `available(c,m)` are as in R2.
- **Needed** `needed(c,m)`: how much more must be assigned this month to satisfy the category's target, in centavos, never negative. It is what the UI shows as "₱X more needed" and what Underfunded assigns.
- **Refund**: an inflow categorized directly to a spending category (a positive categorized transaction).

## 2. Targets

A category has at most one target. A target belongs to the category, not to a month: editing it changes every month, past and future (documented). Credit card payment categories get payoff targets in Milestone B, not here.

### 2.1 Target fields

| field | values |
|---|---|
| `cadence` | `weekly`, `monthly`, `yearly`, `custom` |
| `behavior` | `set_aside` ("Set aside another..."), `refill` ("Refill up to..."), `balance` ("Have a balance of...", custom only) |
| `amount` | centavos, greater than 0 |
| `weekday` | weekly only: the day the week "starts over", 0 (Sunday) to 6 (Saturday) |
| `dueDay` | monthly only: 1 to 31, or `end` for "End of Month". It orders Underfunded and is shown as "by the 1st". It does not change the amount. |
| `dueMonth` | yearly: the "By" month. Custom: the "Due on" month. Month granularity is enough. |
| `repeat` | custom only: `none`, `monthly`, `yearly` |
| `repeatBehavior` | custom with `set_aside` and a repeat: `set_aside` or `refill` |

Valid combinations (documented): weekly, monthly and yearly allow `set_aside` and `refill`. Custom allows `set_aside`, `refill` (YNAB calls it "Fill up to...") and `balance`. `balance` cannot repeat. `balance` may have no due date.

### 2.2 Needed amount per type

`monthsLeft(c,m)` is the number of months from `m` through the due month inclusive. `n(m)` is how many times `weekday` occurs in month `m`.

| id | type | `needed(c,m)` | status |
|---|---|---|---|
| T1 | monthly `set_aside`, amount T | `max(0, T - assigned(c,m))`. Last month's leftover does not count. Spending does not change it. | documented |
| T2 | monthly `refill`, amount T | current or past month: `max(0, T - (carried(c,m) + assigned(c,m)))`. Spending this month does not change it. Future month: `max(0, T - assigned(c,m))` (leftover is ignored until the month begins). | documented |
| T3 | weekly `set_aside` | `max(0, T * n(m) - assigned(c,m))`. A weekday that occurs 5 times in the month asks for 5 times T. | documented |
| T4 | weekly `refill` | `max(0, T * n(m) - (carried + assigned))`, with the future-month rule from T2. | documented |
| T5 | yearly or custom `set_aside`, amount T, due month D | the month's slice: `max(0, ceil((T - assignedInPeriodBefore(c,m)) / monthsLeft(c,m)) - assigned(c,m))`. `assignedInPeriodBefore` is what was assigned to the category from the period start up to the previous month. Example from YNAB: 300 due in six months asks 50 a month. | slice by months left is documented (example). The catch-up rule when a month is skipped is assumed. |
| T6 | yearly or custom `refill` / "Fill up to" | the amount already available counts: `max(0, ceil((T - carried(c,m)) / monthsLeft(c,m)) - assigned(c,m))`. | assumed (YNAB says it "takes into account any currently available funds") |
| T7 | custom `balance` with a due month | same formula as T6: assign so that Available reaches T by the due month. It does not repeat and is not meant to be spent from before it is due. | assumed |
| T8 | custom `balance` with no due date | `max(0, T - (carried + assigned(c,m)))`. It is not part of Underfunded. It shows green whenever Available is above zero. | documented |
| T9 | refunds | A refund in the current month is not counted toward a target. It counts after the target period rolls over (through `carried`). Targets do not look at current-month `activity`. | documented |

Period rules:
- **Monthly and weekly** periods are a calendar month, and the target repeats every month (documented).
- **Yearly** `dueMonth` ends the first period. The next period starts the month after and repeats every year. "Set aside another" only counts what was assigned, so spending does not affect the new period (documented). Only one target period can exist in a month, so a new period starts the month after the previous one ends, even if the due date was earlier in that month (documented).
- **Custom** with `repeat: none` stops asking for money after its due month, so it never needs a snooze or a delete (documented). With `repeat: monthly` or `yearly` the next period starts the month after the due month.
- After the due month passes with `repeat: none`, `needed` is 0.

### 2.3 Target status for a category

Used for the Available pill, the icon and the progress bar. Colors map to Kaban's status display (spec 6.5), where "yellow" is the outlined underfunded pill.

| id | state | when | documented meaning |
|---|---|---|---|
| S1 | overspent (red) | cash overspending (`cashOverspending > 0`) | cash overspending, move money now |
| S2 | credit overspent (yellow, card icon) | `creditOverspending > 0` | shortfall becomes card debt |
| S3 | underfunded (yellow, pie icon) | `needed > 0` and not snoozed | target not met this month |
| S4 | funded (green, check) | `needed = 0` for a target that is due or asks this month | target met |
| S5 | snoozed (green or gray, Zz icon) | see section 2.4 | no longer asks this month |
| S6 | positive, no ask (green) | `available > 0` with no unmet need | all good |
| S7 | zero (gray) | `available = 0` and not underfunded | at zero |

A savings target without a due date (T8) shows green whenever Available is above zero (documented).

Progress bar fill (assumed): `min(1, fundedSoFar / askThisMonth)`, where `askThisMonth = needed + assigned` for set-aside and refill types (what the target asks of this month in total), and `available / T` for `balance`.

### 2.4 Snooze

| id | rule | status |
|---|---|---|
| Z1 | A snoozed target does not ask for more money this month. Available shows green if above zero, gray if zero. | documented |
| Z2 | Snooze lasts one month. The next month asks again. A snooze can only be set in the current month, never in a future month. | documented |
| Z3 | Weekly targets snooze for the whole month. | documented |
| Z4 | Snoozed targets are left out of the Underfunded amount. They still show overfunding and can be reduced by Reduce Overfunding. | documented |
| Z5 | Credit card payment categories cannot be snoozed. | documented |
| Z6 | A snooze is stored per category and month (`target_snoozes`). | design choice |

### 2.5 Cost to Be Me and Edit Plan

| id | rule | status |
|---|---|---|
| C1 | **This month's targets** = the sum, over categories with a target, of what the target asks of this month in full: monthly T; weekly `T * n(m)`; yearly and custom the month's slice. It is the same whether or not the categories are funded. Snoozed targets still count in full. | documented |
| C2 | **Expected income** is one amount per budget. It carries from month to month until changed. | documented. Past months do not keep their own value (assumed). |
| C3 | The margin shown is `expectedIncome - thisMonthsTargets`. | assumed (YNAB shows the two numbers side by side) |
| C4 | **Next month's targets** is shown only when it is higher than this month's. Weekly and monthly use the full amount. Yearly and custom use the slice for next month, which falls as the category is funded and rises if money is unassigned. | documented |

### 2.6 Current goal (Home tab)

One category target can be marked as the **Current Goal**. The Home tab shows its progress as a ring with percent complete, plus Funded and To go (documented). Percent complete uses the progress rule in section 2.3 (assumed).

## 3. Auto-Assign

Entry points (documented): the Ready to Assign pill and the Inspector. Options only appear when they apply (Underfunded needs a shortfall; Reduce Overfunding needs an overfunded category). **Preview before saving:** the user sees which categories get money and can adjust, then taps Save Assignments. The preview needs Ready to Assign above zero. With no categories selected, an option applies to the whole plan except hidden categories. With categories selected (or a Focused View), it applies only to them.

All options write assignment deltas through one move (section 4) so they can be undone as one step.

| id | option | rule | status |
|---|---|---|---|
| A1 | Underfunded | Fund categories in the order in section 3.1 until Ready to Assign reaches 0 or the month is fully funded. | order documented |
| A2 | Underfunded on selected categories | Funds the selected categories in full even if Ready to Assign is too small. Ready to Assign may go negative, with a warning. | documented |
| A3 | Assigned Last Month | Sets this month's assigned amount to last month's assigned amount, per category. | documented. Sets (replaces) rather than adds: assumed. |
| A4 | Spent Last Month | Sets assigned to last month's spending: `max(0, -activity(c, m-1))`. | documented. Refund handling and replace-not-add: assumed. |
| A5 | Average Assigned | Rolling mean of `assigned` over up to the last 12 months before this month, starting at the first month money was assigned to the category. The current month is excluded. | documented. Rounding to the nearest centavo, half up: assumed. |
| A6 | Average Spent | Rolling mean of spending over up to the last 12 months before this month, starting at the first month in that window with any assigned or spent money. Current month excluded. | documented. Rounding as A5. |
| A7 | Reduce Overfunding | For categories with more assigned than their target or scheduled transactions need, move the excess back to Ready to Assign. Appears only if some category is overfunded. | documented. The exact excess is assumed: `max(0, min(available, assigned(c,m) - askThisMonth))`. |
| A8 | Reset Available Amount | Move every positive Available amount back to Ready to Assign ("a plan reset"). Assigned can become negative. Not advised for future months. | documented. Positive amounts only: assumed. |
| A9 | Reset Assigned Amount | Set Assigned to 0. Whole plan needs a confirmation prompt. | documented |

Kaban is single-platform, so all eight options are available (YNAB makes A8 and A9 web-only).

### 3.1 Underfunded order (documented)

When nothing is selected, categories are funded in this order. Ties are broken top to bottom in the category list.

1. Categories with overspending in the current month. They get the overspending covered, and their target is also fully funded (below).
2. Scheduled transactions, and weekly targets and monthly targets with a specific due day, in order of due date. A category with several scheduled transactions in the month is asked for their full monthly total at once, not by individual dates. (Scheduled transactions arrive in Milestone B. Until then this tier holds only weekly and dated monthly targets.)
3. Monthly targets with "End of Month".
4. Custom (and yearly) targets with a due month after this month, in order of due date. Monthly targets always come before these.
5. Credit card payment categories: first those with a scheduled payment, then payoff targets, then those with an Underfunded alert. (Milestone B. Not built in A.)

Ignored by Underfunded (documented): categories with only a `balance` target and no due date; categories with no target and no scheduled transaction and no alert; categories with a snoozed target and no scheduled transaction.

Rules for tier 1 (assumed): assign the overspent amount first, then compute `needed` on the new assigned amount and assign that as well. Example: Dining out is at -300 available, has a 1,000 monthly set-aside target and 0 assigned. Underfunded assigns 1,000 in total (300 covers the overspending, 700 more fills the target). Available ends at +700.

During the very first month of the plan, targets whose due date is before the plan start are funded after targets with an upcoming due date (documented). Not needed in practice for Kaban, so it is skipped unless the owner asks.

## 4. Moving money, Undo, Redo, Recent Moves

| id | rule | status |
|---|---|---|
| M1 | **Move Money** moves an amount between two categories, or between a category and Ready to Assign, in the current or a future month. It is two assignment deltas with one `move_id`. Ready to Assign does not change when moving between two categories. | documented |
| M2 | A move cannot take more than the source category's Available (assumed), except from Ready to Assign, which is limited to the Ready to Assign amount when covering. | assumed |
| M3 | **Cover overspending**: a banner "Cover N overspent categories" appears in the current month. The user picks a source (a funded category or Ready to Assign) for each. The goal is to bring the category back to 0. | documented |
| M4 | **Undo and Redo** are buttons in the Plan toolbar, with Ctrl+Z and Ctrl+Y (Cmd+Z and Cmd+Y on Mac). They affect assigning, money moves and Auto-Assign only, not transactions. Redo is available only after an Undo. A new move clears the redo chain. | documented for assigning and moves (iOS wording). The web scope is assumed to match. |
| M5 | **Recent Moves** lists moves from the last 34 days. Filters: All, Moved (moves and cover-overspending) and Assigned (plain assignments). A row for several categories shows "N categories" and expands to the amounts. Tapping a category name jumps to it. A category's own Details view can list that month's moves, for the current and future months and up to three months back. | documented |
| M6 | Icons in Recent Moves: arrow = moved between categories (origin on the left, destination on the right); lightning = Auto-Assign; money stack = to or from Ready to Assign; calendar plus month name = a move made in a different month; trash can = money moved because a category was deleted. | documented |

Move kinds stored on the move record: `assign` (a plain assignment from Ready to Assign), `move` (between categories), `auto_assign`, `cover` (cover overspending), `delete_category`.

## 5. Plan screen behavior that changes

- **Filters** (Focused Views): All, Overspent, Underfunded, Overfunded, Money available, Snoozed. They narrow the rows, and Auto-Assign and the month summary then apply only to the visible categories (documented).
- **Selection:** a checkbox per category row and per group. One category shows its Inspector sections. Several show a combined summary. None shows the month summary.
- **Inspector with one category** (documented): Target section (what is needed, Edit Target, Snooze, Details), Auto-Assign options for that category, available balance breakdown, notes.
- **Inspector with nothing selected** (documented): Cost to Be Me, Auto-Assign, "Available in [Month]" (Left Over from Last Month, Assigned in Month, Activity, Available), "Assigned in the Future" with a per-month breakdown and a red alert if Ready to Assign would be negative in a future month.
- **Progress bars** are a setting (off by default on laptop, on for phone) (documented that they are optional).
- **Ready to Assign breakdown** (documented, optional in this milestone): clicking Ready to Assign lists what was added (left over from last month, inflows) and what was deducted (cash overspending last month, assigned this month, assigned in the future).

## 6. Verification protocol (owner, in YNAB)

Run these in the "Kaban Test" plan in YNAB, as for R1b to R5c. Report the numbers. If YNAB disagrees with a row above, the row is changed before the code is.

1. **T2 refill, leftover.** Monthly "Refill up to" 5,000 target. Assign 5,000 in October, spend 3,500. Open November: expected needed 3,500. Assign 3,500, spend 100: it should still show funded.
2. **T5 slice and catch-up.** Custom "Set aside", 60,000 due in September of next year, no repeat, set up in October. Expected: asks about 5,000 in October. Assign 5,000. Skip November, assign nothing. Expected in November: asks 5,000 (not 5,500). Then in December: record what it asks (the model predicts 5,500, since 55,000 over 10 months remain).
3. **T3 weekly.** Weekly 1,000, Saturday, "Set aside another". October 2026 has five Saturdays: expected 5,000. November 2026 has four: expected 4,000.
4. **A1 Underfunded order + tier 1.** Set up Dining out at -300 with a 1,000 monthly target and nothing assigned. Press Underfunded with enough Ready to Assign. Record the assigned amount (the model predicts 1,000).
5. **A5 and A6 averages and rounding.** Assign 3,000, 4,000, 5,000 in three consecutive past months to one category: Average Assigned should be 4,000. Try amounts that do not divide evenly (for example 100, 100, 101) and record the rounding.
6. **A7 Reduce Overfunding.** Monthly 5,000 set-aside target, assign 6,000. Expected: 1,000 goes back to Ready to Assign.
7. **M4 Undo scope.** Add a transaction, then an assignment, then Undo. Record whether the transaction or the assignment is undone.

## Sources

YNAB help pages (read 2026-10-06): How to Use Targets; Understanding Target Types in YNAB; Snooze a Target; Underfunded Logic in YNAB; How to Use Auto-Assign in YNAB; The Inspector in YNAB; The Plan Header in YNAB; Colors and Icons in Your Plan; Moving Money in YNAB; How to Fix Mistakes with Undo and Redo; Plan and Adjust with Edit Plan and Cost to Be Me. All are under support.ynab.com.
