import { calculate, type Currency, type Hangout } from "./engine";
export type DebtSource = {
  hangoutId: string;
  title: string;
  fromMemberId: string;
  toMemberId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
};
export type AccountDebt = {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  currency: Currency;
  sources: DebtSource[];
};
/** Offset only the same two actual identities in the same currency. Never merge by name. */
export function accountBalances(hangouts: Hangout[], viewerId: string) {
  const people: Record<
    string,
    { id: string; name: string; userId: string | null }
  > = {};
  const pairs = new Map<
    string,
    {
      a: string;
      b: string;
      currency: Currency;
      net: number;
      sources: DebtSource[];
    }
  >();
  for (const h of hangouts) {
    if (!h.members.some((m) => m.userId === viewerId)) continue;
    for (const m of h.members) {
      const key = m.userId || `local:${h.id}:${m.id}`;
      people[key] = { ...m, id: key };
    }
    for (const tr of calculate(h).transfers) {
      const from = h.members.find((m) => m.id === tr.fromId)!;
      const to = h.members.find((m) => m.id === tr.toId)!;
      if (from.userId !== viewerId && to.userId !== viewerId) continue;
      const f = from.userId || `local:${h.id}:${from.id}`,
        t = to.userId || `local:${h.id}:${to.id}`;
      const [a, b] = [f, t].sort();
      const key = JSON.stringify([h.currency, a, b]);
      const p = pairs.get(key) || {
        a,
        b,
        currency: h.currency,
        net: 0,
        sources: [],
      };
      p.net += (f === a ? 1 : -1) * tr.amount;
      if (!Number.isSafeInteger(p.net)) throw Error("amount");
      p.sources.push({
        hangoutId: h.id,
        title: h.title,
        fromMemberId: from.id,
        toMemberId: to.id,
        fromUserId: f,
        toUserId: t,
        amount: tr.amount,
      });
      pairs.set(key, p);
    }
  }
  const debts: AccountDebt[] = [...pairs.entries()]
    .filter(([, p]) => p.net !== 0)
    .map(([id, p]) => ({
      id,
      fromId: p.net > 0 ? p.a : p.b,
      toId: p.net > 0 ? p.b : p.a,
      amount: Math.abs(p.net),
      currency: p.currency,
      sources: p.sources,
    }))
    .sort(
      (a, b) =>
        a.currency.localeCompare(b.currency) ||
        b.amount - a.amount ||
        a.id.localeCompare(b.id),
    );
  const totals = [
    ...new Set(
      hangouts
        .filter((h) => h.members.some((m) => m.userId === viewerId))
        .map((h) => h.currency),
    ),
  ]
    .sort()
    .map((currency) => ({
      currency,
      owed: debts
        .filter((d) => d.currency === currency && d.fromId === viewerId)
        .reduce((s, d) => s + d.amount, 0),
      receivable: debts
        .filter((d) => d.currency === currency && d.toId === viewerId)
        .reduce((s, d) => s + d.amount, 0),
    }));
  return { people, debts, totals };
}
