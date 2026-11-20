import { it, expect, describe } from "vitest";
import { accountBalances } from "../shared/balances";
import { createApp } from "../server/app";
import { normalizeReceivingValue } from "../shared/receiving";
import type { Hangout, Currency } from "../shared/engine";
function group(
  id: string,
  amount: number,
  from = "alice",
  to = "bob",
  currency: Currency = "AMD",
): Hangout {
  const members = [from, to].map((userId) => ({
    id: id + "-" + userId,
    userId,
    name: userId === "bob" || userId === "another-bob" ? "Bob" : userId,
  }));
  return {
    id,
    title: id,
    description: "",
    date: "2026-11-20",
    icon: "dinner",
    currency,
    ownerId: from,
    members,
    inviteToken: id,
    preferences: {},
    settlements: [],
    expenses: [
      {
        id: id + "-expense",
        title: "Bill",
        payerId: id + "-" + to,
        createdByUserId: to,
        currency,
        createdAt: "",
        tax: 0,
        service: 0,
        tip: 0,
        discount: 0,
        items: [
          {
            title: "Item",
            quantity: 1,
            unitPrice: amount,
            allocations: [{ memberId: id + "-" + from, weight: 1 }],
          },
        ],
      },
    ],
  };
}
describe("saved cross-hangout accounts", () => {
  it("offsets debts for the same identities across all groups despite different membership IDs", () => {
    const hs = [
      group("first", 1300),
      group("older", 900),
      group("reverse", 700, "bob", "alice"),
    ];
    const b = accountBalances(hs, "alice");
    expect(b.debts).toHaveLength(1);
    expect(b.debts[0]).toMatchObject({
      fromId: "alice",
      toId: "bob",
      amount: 1500,
      currency: "AMD",
    });
    expect(b.debts[0].sources).toHaveLength(3);
    expect(b.totals[0].owed).toBe(1500);
    expect(hs[2].expenses[0].items[0].unitPrice).toBe(700);
  });
  it("never merges names or currencies and never exposes unrelated private hangouts", () => {
    const b = accountBalances(
      [
        group("one", 1000),
        group("different-person", 800, "alice", "another-bob"),
        group("usd", 2000, "alice", "bob", "USD"),
        group("private", 9999, "other", "bob"),
      ],
      "alice",
    );
    expect(b.debts).toHaveLength(3);
    expect(b.debts.map((d) => d.amount).sort((a, b) => a - b)).toEqual([
      800, 1000, 2000,
    ]);
    expect(b.people.other).toBeUndefined();
    expect(b.totals).toEqual([
      { currency: "AMD", owed: 1800, receivable: 0 },
      { currency: "USD", owed: 2000, receivable: 0 },
    ]);
  });
  it("retains confirmed and pending semantics and removes zero net pairs without deleting history", () => {
    const first = group("first", 1000),
      reverse = group("second", 1000, "bob", "alice");
    expect(accountBalances([first, reverse], "alice").debts).toHaveLength(0);
    expect(first.expenses).toHaveLength(1);
    first.settlements = [
      {
        id: "s",
        fromId: "first-alice",
        toId: "first-bob",
        amount: 200,
        method: "cash",
        status: "marked",
        createdAt: "",
      },
    ];
    expect(accountBalances([first, reverse], "alice").debts).toHaveLength(0);
    first.settlements[0].status = "confirmed";
    expect(accountBalances([first, reverse], "alice").debts[0]).toMatchObject({
      fromId: "bob",
      toId: "alice",
      amount: 200,
    });
  });
});
it("serves all saved account balances with membership boundaries and live settlement updates", async () => {
  const app = await createApp({ database: ":memory:", demo: true });
  try {
    const guest = async (name: string) => {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/guest",
        payload: { name },
      });
      return {
        cookie: String(r.headers["set-cookie"]).split(";")[0],
        id: r.json().id,
      };
    };
    const a = await guest("Ali"),
      b = await guest("Sara"),
      stranger = await guest("Other");
    const req = (who: typeof a, method: any, url: string, payload?: any) =>
      app.inject({ method, url, payload, headers: { cookie: who.cookie } });
    async function make(title: string, reverse = false) {
      let h = (
        await req(a, "POST", "/api/hangouts", { title, date: "2026-11-20" })
      ).json();
      h = (
        await req(b, "POST", `/api/invites/${h.inviteToken}/join`, {})
      ).json();
      const aid = h.members.find((m: any) => m.userId === a.id).id,
        bid = h.members.find((m: any) => m.userId === b.id).id;
      h = (
        await req(a, "POST", `/api/hangouts/${h.id}/expenses`, {
          title: "Bill",
          currency: "AMD",
          payerId: reverse ? aid : bid,
          items: [
            {
              title: "Food",
              quantity: 1,
              unitPrice: reverse ? 300 : 1000,
              allocations: [{ memberId: reverse ? bid : aid, weight: 1 }],
            },
          ],
          tax: 0,
          tip: 0,
          service: 0,
          discount: 0,
        })
      ).json();
      return { h, aid, bid };
    }
    const first = await make("Earlier"),
      second = await make("Today", true);
    let balances = (await req(a, "GET", "/api/balances")).json();
    expect(balances.debts[0]).toMatchObject({
      fromId: a.id,
      toId: b.id,
      amount: 700,
    });
    expect(balances.debts[0].sources).toHaveLength(2);
    expect(
      (await req(stranger, "GET", "/api/balances")).json().debts,
    ).toHaveLength(0);
    expect(
      (await app.inject({ method: "GET", url: "/api/balances" })).statusCode,
    ).toBe(401);
    let h = (
      await req(a, "POST", `/api/hangouts/${first.h.id}/settlements`, {
        fromId: first.aid,
        toId: first.bid,
        amount: 200,
        method: "cash",
      })
    ).json();
    await req(
      b,
      "POST",
      `/api/hangouts/${h.id}/settlements/${h.settlements[0].id}/confirm`,
      {},
    );
    balances = (await req(a, "GET", "/api/balances")).json();
    expect(balances.debts[0].amount).toBe(500);
    expect(
      (await req(a, "GET", `/api/hangouts/${second.h.id}`)).json().expenses,
    ).toHaveLength(1);
  } finally {
    await app.close();
  }
});
describe("Persian and Arabic receiving details", () => {
  it("normalizes only bank/card numerals and separators, preserving wallet case", () => {
    expect(normalizeReceivingValue("card", "\u200f۶۲۱۹‑۸۶۱۹‑۱۲۳۴‑۵۶۷۸")).toBe(
      "6219861912345678",
    );
    expect(normalizeReceivingValue("bank", "ir ٨٢٠٥٤٠١٠٢٦٨٠٠٢٠٨١٧٩٠٩٠٠٢")).toBe(
      "IR820540102680020817909002",
    );
    expect(normalizeReceivingValue("wallet", "0xAbC123")).toBe("0xAbC123");
  });
  it("saves Persian cards and accounts, permits editing, and returns precise localized error codes", async () => {
    const app = await createApp({ database: ":memory:", demo: true });
    try {
      const auth = await app.inject({
        method: "POST",
        url: "/api/auth/guest",
        payload: { name: "Guest" },
      });
      const headers = {
        cookie: String(auth.headers["set-cookie"]).split(";")[0],
      };
      const r = await app.inject({
        method: "POST",
        url: "/api/receiving-methods",
        headers,
        payload: {
          kind: "card",
          value: "۶۲۱۹ ۸۶۱۹ ۱۲۳۴ ۵۶۷۸",
          preferred: true,
        },
      });
      expect(r.statusCode).toBe(200);
      const id = r.json().id;
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/receiving-methods/" + id,
            headers,
          })
        ).json().value,
      ).toBe("6219861912345678");
      const edit = await app.inject({
        method: "PUT",
        url: "/api/receiving-methods/" + id,
        headers,
        payload: { kind: "card", value: "٦٢١٩-٨٦١٩-١٢٣٤-٥٦٧٨" },
      });
      expect(edit.statusCode).toBe(200);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/receiving-methods",
            headers,
            payload: { kind: "bank", value: "IR ۸۲۰۵۴۰۱۰۲۶۸۰۰۲۰۸۱۷۹۰۹۰۰۲" },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/receiving-methods",
            headers,
            payload: { kind: "card", value: "۱۲۳" },
          })
        ).json().error,
      ).toBe("invalidCard");
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/receiving-methods",
            headers,
            payload: { kind: "bank", value: "" },
          })
        ).json().error,
      ).toBe("receivingRequired");
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/receiving-methods",
            headers,
            payload: { kind: "cash" },
          })
        ).statusCode,
      ).toBe(200);
    } finally {
      await app.close();
    }
  });
});

it("keeps rate limits per verified guest so different users behind one IP do not block each other", async () => {
  const app = await createApp({ database: ":memory:", demo: true });
  try {
    const signup = async (name: string) => {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/guest",
        payload: { name },
      });
      return { cookie: String(r.headers["set-cookie"]).split(";")[0] };
    };
    const a = await signup("A"),
      b = await signup("B");
    for (let i = 0; i < 175; i++)
      expect(
        (await app.inject({ method: "GET", url: "/api/me", headers: a }))
          .statusCode,
      ).toBe(200);
    for (let i = 0; i < 25; i++)
      expect(
        (await app.inject({ method: "GET", url: "/api/me", headers: b }))
          .statusCode,
      ).toBe(200);
    let limited = false;
    for (let i = 0; i < 10; i++)
      if (
        (await app.inject({ method: "GET", url: "/api/me", headers: a }))
          .statusCode === 429
      )
        limited = true;
    expect(limited).toBe(true);
  } finally {
    await app.close();
  }
});
