export function formatMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0.00";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function splitEqual(amount, ids) {
  const n = ids.length || 1;
  const totalCents = Math.round(Number(amount) * 100);
  const baseCents = Math.floor(totalCents / n);
  const remainder = totalCents - baseCents * n;
  const shares = {};
  ids.forEach((id, i) => {
    const cents = baseCents + (i < remainder ? 1 : 0);
    shares[id] = cents / 100;
  });
  return shares;
}

export function percentsSumTo100(percents) {
  const values = Object.values(percents).map(Number);
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 100) < 0.001;
}

export function splitByPercent(amount, percents) {
  const totalCents = Math.round(Number(amount) * 100);
  const entries = Object.entries(percents);
  const rawCents = entries.map(([, pct]) => (totalCents * Number(pct)) / 100);
  const floored = rawCents.map((c) => Math.floor(c));
  let remainder = totalCents - floored.reduce((a, b) => a + b, 0);
  // Distribute remainder cents to entries with the largest fractional parts
  const indexed = floored.map((f, i) => ({ i, frac: rawCents[i] - f }));
  indexed.sort((a, b) => b.frac - a.frac);
  for (const item of indexed) {
    if (remainder <= 0) break;
    floored[item.i] += 1;
    remainder -= 1;
  }
  const shares = {};
  entries.forEach(([id], i) => {
    shares[id] = floored[i] / 100;
  });
  return shares;
}

export function sharesForExpense(expense) {
  if (expense.splitType === "percent" && expense.percents) {
    return splitByPercent(expense.amount, expense.percents);
  }
  return splitEqual(expense.amount, expense.splitWith);
}
