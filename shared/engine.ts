export type Currency = "AMD" | "USD" | "EUR" | "USDT";
export type Member = { id: string; name: string; userId: string | null };
export type Item = {
  id?: string;
  title: string;
  quantity: number;
  unitPrice: number;
  allocations: { memberId: string; weight: number }[];
};
export type Expense = {
  id: string;
  title: string;
  payerId: string;
  currency: Currency;
  items: Item[];
  tax: number;
  service: number;
  tip: number;
  discount: number;
  createdAt: string;
};
export type Settlement = {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  status: "pending" | "marked" | "confirmed";
  method: string;
  createdAt: string;
};
export type Hangout = {
  id: string;
  title: string;
  description: string;
  currency: Currency;
  date: string;
  icon: string;
  ownerId: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  inviteToken: string;
  preferences: Record<string, { method: string; details: string }>;
};
export const precision = (currency: Currency) => (currency === "AMD" ? 0 : 2);
export function minor(value: string, currency: Currency): number {
  const p = precision(currency);
  if (
    !new RegExp(`^\\d+(?:\\.\\d{1,${p || 1}})?$`).test(value) ||
    (!p && value.includes("."))
  )
    throw Error("amount");
  const [whole, dec = ""] = value.split(".");
  const n =
    BigInt(whole) * 10n ** BigInt(p) + BigInt(dec.padEnd(p, "0") || "0");
  if (n > 1_000_000_000_000n) throw Error("amount");
  return Number(n);
}
export function distribute(
  amount: number,
  weights: { memberId: string; weight: number }[],
): Record<string, number> {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !weights.length ||
    weights.some((w) => !Number.isSafeInteger(w.weight) || w.weight <= 0) ||
    new Set(weights.map((w) => w.memberId)).size !== weights.length
  )
    throw Error("allocation");
  const total = weights.reduce((s, w) => s + BigInt(w.weight), 0n);
  const out: Record<string, number> = {};
  const parts = weights
    .map((w) => {
      const v = BigInt(amount) * BigInt(w.weight);
      out[w.memberId] = Number(v / total);
      return { id: w.memberId, remainder: v % total };
    })
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.id.localeCompare(b.id)
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  let rest = amount - Object.values(out).reduce((a, b) => a + b, 0);
  for (const part of parts) {
    if (rest-- <= 0) break;
    out[part.id]++;
  }
  return out;
}
export function expenseShares(expense: Expense) {
  const shares: Record<string, number> = {};
  let subtotal = 0;
  for (const item of expense.items) {
    const amount = item.quantity * item.unitPrice;
    if (!Number.isSafeInteger(amount) || amount < 0) throw Error("amount");
    subtotal += amount;
    for (const [id, n] of Object.entries(distribute(amount, item.allocations)))
      shares[id] = (shares[id] || 0) + n;
  }
  const adjustment =
    expense.tax + expense.service + expense.tip - expense.discount;
  if (
    !Number.isSafeInteger(subtotal) ||
    subtotal + adjustment < 0 ||
    subtotal + adjustment > 1_000_000_000_000
  )
    throw Error("amount");
  if (adjustment) {
    if (!subtotal) throw Error("amount");
    const split = distribute(
      Math.abs(adjustment),
      Object.entries(shares)
        .filter(([, v]) => v > 0)
        .map(([memberId, weight]) => ({ memberId, weight })),
    );
    for (const [id, n] of Object.entries(split))
      shares[id] += Math.sign(adjustment) * n;
  }
  return { shares, total: subtotal + adjustment };
}
export function calculate(
  h: Pick<Hangout, "members" | "expenses" | "settlements" | "currency">,
) {
  const balances = Object.fromEntries(
    h.members.map((m) => [m.id, { consumed: 0, paid: 0, net: 0 }]),
  );
  let total = 0;
  for (const expense of h.expenses) {
    if (expense.currency !== h.currency || !balances[expense.payerId])
      throw Error("currency");
    const result = expenseShares(expense);
    total += result.total;
    balances[expense.payerId].paid += result.total;
    for (const [id, n] of Object.entries(result.shares)) {
      if (!balances[id]) throw Error("member");
      balances[id].consumed += n;
    }
  }
  if (!Number.isSafeInteger(total)) throw Error("amount");
  for (const b of Object.values(balances)) {
    if (!Number.isSafeInteger(b.paid) || !Number.isSafeInteger(b.consumed)) throw Error("amount");
    b.net = b.paid - b.consumed;
  }
  for (const s of h.settlements.filter((s) => s.status === "confirmed")) {
    if (
      !balances[s.fromId] ||
      !balances[s.toId] ||
      !Number.isSafeInteger(s.amount) ||
      s.amount <= 0
    )
      throw Error("settlement");
    balances[s.fromId].net += s.amount;
    balances[s.toId].net -= s.amount;
  }
  const debtors = Object.entries(balances)
    .filter(([, b]) => b.net < 0)
    .map(([id, b]) => ({ id, n: -b.net }))
    .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  const creditors = Object.entries(balances)
    .filter(([, b]) => b.net > 0)
    .map(([id, b]) => ({ id, n: b.net }))
    .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  const transfers: { fromId: string; toId: string; amount: number }[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].n, creditors[j].n);
    transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, amount });
    debtors[i].n -= amount;
    creditors[j].n -= amount;
    if (!debtors[i].n) i++;
    if (!creditors[j].n) j++;
  }
  return { total, balances, transfers };
}
