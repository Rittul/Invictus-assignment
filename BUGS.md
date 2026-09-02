# Bugs found

---

## Bug 1 — Expense list sorted oldest-first instead of newest-first

**Severity:** Medium

**How to reproduce:**
1. Open the app with the demo data.
2. The expense list header says "Newest first".
3. Observe that Wine (7 Mar) appears at the top and Board game (15 Mar) is near the bottom.

**Expected behavior:**
Board game (15 Mar) should appear first; Wine (7 Mar) should appear last.

**Actual behavior:**
Expenses are sorted oldest-first (ascending), the opposite of what the label claims.

**Root cause:**
In `ExpenseList.jsx`, the sort comparator was `dateValue(a.date) - dateValue(b.date)` which sorts ascending. Additionally, `dateValue()` in `format.js` was an identity function (`return date`) which returns the raw value instead of a numeric timestamp, causing unreliable comparisons.

**Fix:**
1. Changed sort to `dateValue(b.date) - dateValue(a.date)` (descending) in `ExpenseList.jsx`.
2. Fixed `dateValue()` in `format.js` to return `date.getTime()` for Date objects and `new Date(date).getTime()` for strings, so date comparisons always use numeric timestamps.

**Verification:**
After the fix, Board game (15 Mar) appears first and Wine (7 Mar) appears last, matching the "Newest first" label.

---

## Bug 2 — Payer excluded from split gets incorrectly charged

**Severity:** Critical

**How to reproduce:**
1. Create an expense: $900 paid by Aisha Khan.
2. Split equally between Ben Okonkwo, Carlos Mendes, and Diya Patel only.
3. Aisha is NOT included in the split.

**Expected behavior:**
Aisha: +$900, Ben: −$300, Carlos: −$300, Diya: −$300.

**Actual behavior:**
The original code subtracted an additional `amount / n` from the payer when they weren't in the split, producing wildly wrong balances (Aisha: −$815 instead of +$900).

**Root cause:**
`balances.js` originally contained an extra block:
```js
if (!(exp.paidBy in shares) && !(String(exp.paidBy) in shares)) {
  const n = exp.splitWith.length || 1;
  bal[exp.paidBy] -= Number(exp.amount) / n;
}
```
This incorrectly subtracted a share from the payer, double-penalizing them.

**Fix:**
Removed the extra subtraction block. The corrected `computeBalances` credits the payer with the full amount paid and only subtracts shares from people in the split. This was already applied in the current codebase.

**Verification:**
With the $900 cab test: Aisha = +$900, Ben = −$300, Carlos = −$300, Diya = −$300. Sum of all balances = $0.00.

---

## Bug 3 — Balance labels were reversed (owed ↔ owes)

**Severity:** Critical

**How to reproduce:**
1. Open the app with demo data.
2. Look at the Balances panel.
3. A member with a positive balance (paid more than consumed) should show "is owed".

**Expected behavior:**
- Positive balance → "is owed $X" (green, `owed` class)
- Negative balance → "owes $X" (red, `owe` class)

**Actual behavior:**
The original code had the labels and CSS classes swapped: positive balance showed "owes" and negative showed "is owed".

**Root cause:**
In `BalancesPanel.jsx`, the `if (bal > 0.005)` branch originally used `label = "owes ..."` and `cls = "owe"`, and the `else if (bal < -0.005)` branch used `label = "is owed ..."` and `cls = "owed"`. These were reversed.

**Fix:**
Corrected the labels so positive balance → "is owed" (class `owed`) and negative balance → "owes" (class `owe`). This was already applied in the current codebase.

**Verification:**
Members who paid more than they consumed now display "is owed" in green; members who consumed more show "owes" in red.

---

## Bug 4 — Equal split loses money due to rounding

**Severity:** Critical

**How to reproduce:**
1. Create an expense of $100 split equally between 3 people.
2. Check the individual shares.

**Expected behavior:**
Shares must sum to exactly $100.00 (e.g., $33.34 + $33.33 + $33.33).

**Actual behavior:**
The original `splitEqual` computed `(100 / 3).toFixed(2)` = $33.33 for each person, totaling $99.99. One cent is lost.

**Root cause:**
In `money.js`, `splitEqual` computed a single rounded share and assigned it to every participant:
```js
const share = Number((amount / n).toFixed(2));
```
This truncates the remainder. For $100/3, each person gets $33.33 and $0.01 vanishes.

**Fix:**
Rewrote `splitEqual` to use integer-cent arithmetic:
- Convert amount to cents: `Math.round(amount * 100)`
- Compute `baseCents = Math.floor(totalCents / n)`
- Compute `remainder = totalCents - baseCents * n`
- First `remainder` participants each get one extra cent

For $100/3: base = 3333 cents, remainder = 1. Result: $33.34 + $33.33 + $33.33 = $100.00.

**Verification:**
Tested with $100/3, $10/3, $1/3, $100/6, $99.99/7. All sums match the original amount exactly to the cent.

---

## Bug 5 — Percentage split loses money due to rounding

**Severity:** Critical

**How to reproduce:**
1. Create $100 split by percentage: 33.33%, 33.33%, 33.34%.
2. Check the individual shares.

**Expected behavior:**
Shares must sum to exactly $100.00.

**Actual behavior:**
The original `splitByPercent` independently rounded each share with `.toFixed(2)`, which can cause the sum to be off by one or more cents.

**Root cause:**
In `money.js`, `splitByPercent` computed each share independently:
```js
shares[id] = Number(((amount * pct) / 100).toFixed(2));
```
Independent rounding doesn't guarantee the shares sum to the original amount.

**Fix:**
Rewrote `splitByPercent` using the largest-remainder method in integer cents:
- Compute raw cents for each participant
- Floor all values
- Distribute the remaining cents one at a time to participants with the largest fractional parts

This guarantees shares sum to exactly the original amount.

**Verification:**
Tested with $100 at 33.33/33.33/33.34, $99.99 at 25/25/25/25, $10 at 33.33/33.33/33.34. All sums are exact.

---

## Bug 6 — Percentage validation rejects valid floating-point sums

**Severity:** High

**How to reproduce:**
1. Set up a percentage split with values like 33.33%, 33.33%, 33.34%.
2. Try to save the expense.

**Expected behavior:**
33.33 + 33.33 + 33.34 = 100.00 should be accepted.

**Actual behavior:**
Due to floating-point arithmetic, `33.33 + 33.33 + 33.34` can evaluate to `99.99999999999999` or `100.00000000000001`, which fails a strict `=== 100` check.

**Root cause:**
In `money.js`, `percentsSumTo100` used strict equality:
```js
return values.reduce((a, b) => a + b, 0) === 100;
```

**Fix:**
Changed to a tolerance-based comparison:
```js
return Math.abs(sum - 100) < 0.001;
```

**Verification:**
Percentages 33.33/33.33/33.34 are now accepted. Values summing to 99 or 101 are still rejected.

---

## Bug 7 — Settlement algorithm drops transfers when debtor and creditor amounts are equal

**Severity:** Critical

**How to reproduce:**
1. Create expenses such that one member owes exactly $50 and another is owed exactly $50.
2. Check the Settle Up panel.

**Expected behavior:**
One transfer: debtor pays creditor $50.

**Actual behavior:**
No transfer is generated. The Settle Up panel shows "Everyone is settled" even though balances are not zero.

**Root cause:**
In `settle.js`, the `else` branch (when `d.amount === c.amount`) advanced both pointers but never pushed a transfer:
```js
} else {
  i += 1;
  j += 1;
}
```

**Fix:**
Added the missing `transfers.push(...)` call in the equality branch before advancing the pointers.

**Verification:**
With balanced $50 debtor/creditor, exactly one transfer of $50 is now generated. Applied to all seed data balances, post-settlement balances are all $0.00.

---

## Bug 8 — Filtered/sorted expense delete and edit target the wrong expense

**Severity:** Critical

**How to reproduce:**
1. Open the app with demo data.
2. Filter to category "Food" (shows 4 of 9 expenses).
3. Delete the first displayed expense.
4. Observe that a completely different expense is removed from the full list.

**Expected behavior:**
The exact expense shown on screen should be deleted.

**Actual behavior:**
The code passed the display `index` (position in the filtered/sorted array) to `dispatch({ type: "DELETE_EXPENSE", index })`, but the reducer used that index to splice from the original `state.expenses` array. After filtering or sorting, index 0 in the displayed list does not correspond to index 0 in state.

**Root cause:**
`ExpenseList.jsx` used `sorted.map((expense, index) => ...)` and passed `index` to `onDeleteAt`/`onUpdateAt`. `App.jsx` forwarded this as `dispatch({ type: "DELETE_EXPENSE", index })`. The reducer then did `state.expenses.splice(index, 1)` — which targets the wrong expense when the list is filtered or reordered.

**Fix:**
Changed the entire chain to use expense `id` instead of array index:
- `ExpenseList.jsx`: passes `expense.id` to `onDeleteAt` and `onUpdateAt`
- `App.jsx`: dispatches `{ type: "DELETE_EXPENSE", id }` and `{ type: "UPDATE_EXPENSE", id, patch }`
- `store.js` reducer: `DELETE_EXPENSE` uses `.filter(e => e.id !== action.id)`; `UPDATE_EXPENSE` uses `.map()` to match by id

Also changed the React `key` from `index` to `expense.id` for correct reconciliation.

**Verification:**
Filtering to "Food", deleting the first item removes exactly that expense. Editing an amount while filtered also targets the correct expense.

---

## Bug 9 — Persistence does not hydrate dates from localStorage

**Severity:** High

**How to reproduce:**
1. Open the app (data loads from localStorage).
2. Refresh the browser.
3. Observe that expense dates display as raw strings like "2026-03-12" instead of formatted dates like "12 Mar 2026".
4. Sorting may also break because `dateValue()` was comparing raw strings.

**Expected behavior:**
After refresh, dates should be Date objects, display correctly, and sort correctly.

**Actual behavior:**
`loadState` in `store.js` called `JSON.parse(raw)` without hydrating. Since `JSON.stringify` converts Date objects to ISO strings, the reloaded state had string dates instead of Date objects.

**Root cause:**
```js
return JSON.parse(raw);  // dates are strings, not Date objects
```
The `hydrate()` function (which converts date strings to Date objects) was only called for the seed data path, not the localStorage path.

**Fix:**
Changed `loadState` to pass the parsed data through `hydrate()`:
```js
return hydrate(JSON.parse(raw));
```

Also fixed `dateValue()` in `format.js` to handle both Date objects and strings by converting to `.getTime()` / `new Date(date).getTime()`, providing a safety net.

**Verification:**
After refresh, dates display correctly as formatted dates, and sorting works properly.

---

## Bug 10 — "Paid by" filter never matches any expenses

**Severity:** High

**How to reproduce:**
1. Open the app with demo data.
2. In the Filter section, select "Paid by: Aisha Khan" from the dropdown.
3. Observe that no expenses are shown, even though Aisha paid for Groceries and Museum tickets.

**Expected behavior:**
Filtering by "Aisha Khan" should show her 2 expenses.

**Actual behavior:**
Zero results. The filter dropdown's `onChange` provides `e.target.value` as a string (e.g. `"1"`), but `expense.paidBy` is a number (e.g. `1`). The comparison `e.paidBy !== paidBy` compares number to string, which is always `true` with `!==`.

**Root cause:**
In `App.jsx`:
```js
if (paidBy !== "" && e.paidBy !== paidBy) return false;
```
`paidBy` state comes from a `<select>` element (`e.target.value`) which always returns a string, but `expense.paidBy` is a number.

**Fix:**
Changed the comparison to convert `paidBy` to a number:
```js
if (paidBy !== "" && e.paidBy !== Number(paidBy)) return false;
```

**Verification:**
Selecting "Aisha Khan" now correctly shows her 2 expenses. Other member filters work correctly too.

---

## Bug 11 — Summary "Paid so far" section doesn't update when a new member is added

**Severity:** Medium

**How to reproduce:**
1. Open the app with demo data.
2. Add a new member (e.g., "Eve").
3. Observe the "Paid so far" section in the Summary card.

**Expected behavior:**
Eve should appear in the "Paid so far" list with $0.00.

**Actual behavior:**
Eve does not appear until an expense is added or modified, because the memoized computation doesn't re-run.

**Root cause:**
In `SummaryCards.jsx`, the `useMemo` for `perPerson` had an incomplete dependency array:
```js
}, [expenses]);
```
It used `members` inside the callback but didn't list it as a dependency. React would skip recomputation when `members` changed.

**Fix:**
Added `members` to the dependency array:
```js
}, [members, expenses]);
```

**Verification:**
After adding a new member, they immediately appear in the "Paid so far" list with $0.00.

---