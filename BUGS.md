# Bugs Found

Add one section per issue. Bug 1 is filled in to show the format — fix it, then write what you changed. Copy the blank template for the rest.

---

## Bug 1

**How to reproduce:** Open the app. The expense list says "Newest first". The first row is Wine (7 Mar). Board game (15 Mar) is further down.

**What is wrong:** The list is showing oldest expenses first. Newest should be at the top.

**What I changed:** The sort comparator in `ExpenseList.jsx` was doing `a - b` which sorts ascending (oldest first). I flipped it to `b - a` so the most recent expenses show up at the top. I also fixed `dateValue()` in `format.js` — it was returning the raw date object instead of a numeric timestamp, so the sort wasn't comparing numbers properly.

---

## Bug 2

**How to reproduce:** Add an expense where someone pays for others but isn't part of the split themselves. For example, have Aisha pay $900 split equally between Ben, Carlos, and Diya — but not Aisha. Check Aisha's balance.

**What is wrong:** Aisha should be owed the full $900 since she paid but didn't consume anything. Instead, her balance shows around -$815 because the code was incorrectly subtracting an extra share from the payer even when they weren't in the split list.

**What I changed:** In `balances.js`, there was an extra block that subtracted `amount / n` from the payer whenever they weren't included in the split. That logic doesn't make sense — the payer already gets credited for the full amount they paid, and they should only be debited if they're actually in the split. I removed that extra subtraction.

---

## Bug 3

**How to reproduce:** Look at the Balances panel on the right side of the app. Compare what it says with what you'd expect based on the expenses.

**What is wrong:** The labels are backwards. People who are owed money show "owes $X" and people who owe money show "is owed $X". It's the exact opposite of what it should be.

**What I changed:** In `BalancesPanel.jsx`, the `if/else` branches had the labels and CSS classes swapped. A positive balance means the person paid more than their share, so they should show "is owed". A negative balance means they consumed more than they paid, so they should show "owes". I swapped the labels and class names to match.

---

## Bug 4

**How to reproduce:** Split $100 equally among 3 people. Check the individual shares and add them up.

**What is wrong:** Each person gets $33.33, which totals $99.99. A penny goes missing. Over multiple expenses, these lost cents add up and the group's numbers stop balancing out.

**What I changed:** Rewrote `splitEqual` in `money.js` to work in whole cents instead of dollars. It floor-divides the total cents by the number of people, then hands out the leftover cents one at a time to the first few people. So $100 among 3 becomes $33.34 + $33.33 + $33.33 = $100.00 exactly.

---

## Bug 5

**How to reproduce:** Create an expense with a percentage split, like 33.33% / 33.33% / 33.34%. Check whether the dollar shares add up to the original amount.

**What is wrong:** Same penny-loss problem as Bug 4, but for percentage splits. Each share was independently rounded with `.toFixed(2)`, so the total could come up short or over by a cent.

**What I changed:** Rewrote `splitByPercent` in `money.js` using the largest-remainder method in cents. It calculates raw cent values, floors them all, then distributes the leftover cents to the entries with the biggest fractional parts. This way the shares always sum to the exact total.

---

## Bug 6

**How to reproduce:** Try adding an expense with a percentage split of 33.33% + 33.33% + 33.34%. Hit save.

**What is wrong:** The form rejects it saying percentages don't add to 100, even though they clearly do. The problem is floating-point arithmetic — those three numbers can sum to 99.99999… or 100.00001 in JavaScript, and the code was doing a strict `=== 100` check.

**What I changed:** Updated `percentsSumTo100` in `money.js` to use a tolerance instead of exact equality. It now passes if the sum is within 0.001 of 100, which handles normal floating-point drift without letting genuinely wrong splits through.

---

## Bug 7

**How to reproduce:** Set up a scenario where one person owes exactly what another person is owed. For example, if after all expenses, Ben owes exactly $50 and Carlos is owed exactly $50. Look at the Settle Up panel.

**What is wrong:** The settlement that should connect them is missing entirely. The app just skips it.

**What I changed:** In `settle.js`, the `else` branch (which handles the case where a debtor's amount exactly equals a creditor's amount) was advancing both pointers but never actually pushing the transfer to the results array. I added the missing `transfers.push(...)` call so that exact-match settlements show up.

---

## Bug 8

**How to reproduce:** Filter the expense list (for example, show only "Food" expenses). Then try deleting or editing one of the filtered results.

**What is wrong:** The wrong expense gets deleted or edited. The code was using the item's position in the filtered/sorted list as an index into the original unfiltered array. So if you delete item #0 in a filtered view, it actually deletes whatever is at position #0 in the full list — which is probably a completely different expense.

**What I changed:** Switched the entire delete/edit chain — in `ExpenseList.jsx`, `App.jsx`, and `store.js` — from using array indices to using expense `id` values. Now when you click delete on "Groceries", it finds and removes the expense with that specific ID regardless of filtering or sorting. Also fixed the React `key` props to use IDs.

---

## Bug 9

**How to reproduce:** Add some expenses, then refresh the page. Look at the dates in the expense list.

**What is wrong:** After a refresh, dates show up as raw strings like "2026-03-12" instead of the nice formatted version like "12 Mar 2026". Sorting also breaks because the code expects Date objects but gets strings back from localStorage.

**What I changed:** The issue was in `loadState` in `store.js`. When the state is saved, `JSON.stringify` converts Date objects to ISO strings. On reload, `JSON.parse` brings them back as plain strings, but the code never converted them back to Date objects. I added a `hydrate()` step that wraps each expense's date string in `new Date(...)`. Also made `dateValue()` in `format.js` handle both types as a safety net.

---

## Bug 10

**How to reproduce:** Use the "Paid by" filter dropdown in the Filter section. Select any person's name.

**What is wrong:** No expenses show up, even though that person definitely paid for some. Every single option returns zero results.

**What I changed:** The `<select>` element returns its value as a string (like `"1"`), but `expense.paidBy` is stored as a number (`1`). The filter was using strict comparison (`!==`), so `"1" !== 1` was always true and everything got filtered out. I added `Number(paidBy)` in the filter comparison in `App.jsx` so the types match.

---

## Bug 11

**How to reproduce:** Look at the "Paid so far" section in the Summary panel. Now add a new member to the group.

**What is wrong:** The new member doesn't appear in the "Paid so far" list until you add or change an expense. The list is stale because it doesn't know the members changed.

**What I changed:** In `SummaryCards.jsx`, the `useMemo` that calculates per-person stats was using `members` inside the callback but only had `[expenses]` in the dependency array. React didn't know to recalculate when members changed. I added `members` to the dependency array so it updates immediately.

---

## Bug 12

**How to reproduce:** Fill out the Add Expense form and click "Save expense". Look at the form after saving.

**What is wrong:** All the fields still have the old values in them. It looks like nothing happened, and if you accidentally click Save again you'd create a duplicate expense.

**What I changed:** The `submit` handler in `AddExpenseForm.jsx` was calling `onAdd(...)` to save the expense but never clearing the form fields afterward. I added state resets for description, amount, date, split type, split-with list, and percent values so the form goes back to a clean state after each successful save.

---

## Bug 13

**How to reproduce:** Look at the inline amount field next to any expense in the list. Now change the amount by editing it inline and blurring. Then change it again from somewhere else (or reload with different data).

**What is wrong:** The inline edit input shows the old amount from when the component first appeared. If the expense amount changes externally (through another edit or a reload), the input doesn't update to match.

**What I changed:** `ExpenseRow` in `ExpenseList.jsx` initializes the draft amount with `useState(String(expense.amount))`, which only runs once when the component mounts. I added a `useEffect` that watches `expense.amount` and syncs the draft value whenever it changes from outside, so the input always reflects the current amount.

---

## Bug 14

**How to reproduce:** Open the app and look at what date is pre-filled in the "Date" field of the Add Expense form.

**What is wrong:** The date was hardcoded to `"2026-03-16"` instead of using today's actual date. So every new expense would default to that fixed date regardless of when you're using the app.

**What I changed:** Replaced the hardcoded string with a `todayStr()` helper function in `AddExpenseForm.jsx` that returns the current date in `YYYY-MM-DD` format using `new Date().toISOString().slice(0, 10)`.

---

## Bug 15

**How to reproduce:** Add a new member to the group using the "Add member" form in the Summary panel. Then go to add a new expense and look at the "Split between" chips.

**What is wrong:** The new member doesn't appear in the split-between list. They're part of the group but can't be included in new expenses unless you reload the page.

**What I changed:** In `AddExpenseForm.jsx`, the `splitWith` state was initialized once on mount from the original members list and never updated when new members joined. I added a `useEffect` that watches the `members` prop and appends any new member IDs to `splitWith`, then recalculates the even-split percentages to include them.