import { describe, it, expect } from "vitest";
import { createApp } from "../server/app";
import { openDatabase } from "../server/db";
import { expenseShares, calculate, type Expense } from "../shared/engine";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "dong-v12-"));
  const path = join(dir, "test.sqlite");
  const app = await createApp({ database: path, demo: true });
  const guest = async (name: string) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/guest",
      payload: { name },
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers["set-cookie"]).toContain("HttpOnly");
    return {
      me: r.json(),
      cookie: String(r.headers["set-cookie"]).split(";")[0],
    };
  };
  const ali = await guest("Ali"),
    sara = await guest("Sara"),
    reza = await guest("Reza");
  const req = (
    who: typeof ali,
    method: any,
    url: string,
    payload?: any,
    extra = {},
  ) =>
    app.inject({
      method,
      url,
      payload,
      headers: { cookie: who.cookie, ...extra },
    });
  let h = (
    await req(ali, "POST", "/api/hangouts", {
      title: "Friday Dinner",
      date: "2026-11-20",
    })
  ).json();
  h = (
    await req(sara, "POST", `/api/invites/${h.inviteToken}/join`, {})
  ).json();
  const base = `/api/hangouts/${h.id}`;
  const aid = h.members.find((m: any) => m.userId === ali.me.id).id,
    bid = h.members.find((m: any) => m.userId === sara.me.id).id;
  const expense = (payerId = aid, price = 20000) => ({
    title: "Dinner",
    payerId,
    currency: "AMD",
    items: [
      {
        title: "Food",
        quantity: 1,
        unitPrice: price,
        allocations: [
          { memberId: aid, weight: 1 },
          { memberId: bid, weight: 1 },
        ],
      },
    ],
    tax: 0,
    service: 0,
    tip: 0,
    discount: 0,
  });
  const close = async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  };
  return {
    app,
    path,
    guest,
    ali,
    sara,
    reza,
    req,
    h,
    base,
    aid,
    bid,
    expense,
    close,
  };
}
describe("v1.2 identity, ownership and invitation boundaries", () => {
  it("uses distinct opaque sessions, preserves names, never accepts Demo identity, and joins idempotently", async () => {
    const f = await setup();
    try {
      const same = await f.guest("Ali");
      expect(same.me.id).not.toBe(f.ali.me.id);
      expect((await f.req(f.ali, "GET", "/api/me")).json().id).toBe(
        f.ali.me.id,
      );
      expect(
        (
          await f.app.inject({
            method: "GET",
            url: "/api/me",
            headers: { authorization: "Demo ali" },
          })
        ).statusCode,
      ).toBe(401);
      expect((await f.req(same, "GET", f.base)).statusCode).toBe(403);
      expect(
        (
          await f.app.inject({
            method: "GET",
            url: `/api/invites/${f.h.inviteToken}`,
          })
        ).json(),
      ).toEqual({ title: "Friday Dinner", memberCount: 2 });
      const joins = await Promise.all(
        Array.from({ length: 8 }, () =>
          f.req(f.sara, "POST", `/api/invites/${f.h.inviteToken}/join`, {}),
        ),
      );
      expect(joins.every((r) => r.statusCode === 200)).toBe(true);
      expect(joins[7].json().members).toHaveLength(2);
      const logs = (await f.req(f.ali, "GET", f.base + "/activity")).json()
        .events;
      expect(logs.filter((e: any) => e.type === "member.joined")).toHaveLength(
        1,
      );
    } finally {
      await f.close();
    }
  });
  it("rejects expired and revoked invitations without exposing expenses", async () => {
    const f = await setup();
    try {
      const db = openDatabase(f.path);
      db.db
        .prepare("UPDATE invitations SET expires_at=? WHERE token=?")
        .run("2000-01-01T00:00:00.000Z", f.h.inviteToken);
      db.db.close();
      expect(
        (
          await f.req(
            f.reza,
            "POST",
            `/api/invites/${f.h.inviteToken}/join`,
            {},
          )
        ).statusCode,
      ).toBe(404);
      expect((await f.req(f.reza, "GET", f.base)).statusCode).toBe(403);
      const h = (await f.req(f.ali, "POST", f.base + "/invite", {})).json();
      expect(
        (
          await f.app.inject({
            method: "GET",
            url: `/api/invites/${f.h.inviteToken}`,
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (await f.req(f.reza, "POST", `/api/invites/${h.inviteToken}/join`, {}))
          .statusCode,
      ).toBe(200);
    } finally {
      await f.close();
    }
  });
  it("separates immutable creator and payer; blocks others and requires explicit owner administration", async () => {
    const f = await setup();
    try {
      let h = (
        await f.req(f.sara, "POST", f.base + "/expenses", {
          ...f.expense(),
          createdByUserId: f.ali.me.id,
        })
      ).json();
      let e = h.expenses[0];
      expect(e.createdByUserId).toBe(f.sara.me.id);
      expect(e.payerId).toBe(f.aid);
      const body = { ...f.expense(f.bid), expectedRevision: e.revision };
      expect(
        (await f.req(f.ali, "PUT", f.base + `/expenses/${e.id}`, body))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await f.req(
            f.ali,
            "DELETE",
            f.base + `/expenses/${e.id}`,
            undefined,
            { "If-Match": String(e.revision) },
          )
        ).statusCode,
      ).toBe(403);
      h = (
        await f.req(f.sara, "PUT", f.base + `/expenses/${e.id}`, body)
      ).json();
      expect(h.expenses[0].payerId).toBe(f.bid);
      expect(
        (await f.req(f.sara, "PUT", f.base + `/expenses/${e.id}`, body))
          .statusCode,
      ).toBe(409);
      h = (
        await f.req(
          f.ali,
          "PUT",
          f.base + `/expenses/${e.id}`,
          { ...body, expectedRevision: 2 },
          { "X-Admin-Action": "true" },
        )
      ).json();
      expect(h.expenses[0].createdByUserId).toBe(f.sara.me.id);
      const logs = (await f.req(f.sara, "GET", f.base + "/activity")).json()
        .events;
      expect(
        logs.some(
          (l: any) =>
            l.metadata.administrative === true && l.actorUserId === f.ali.me.id,
        ),
      ).toBe(true);
      expect(
        logs.some(
          (l: any) =>
            l.type === "expense.payerChanged" && l.resourceId === e.id,
        ),
      ).toBe(true);
      expect(
        (
          await f.req(
            f.sara,
            "DELETE",
            f.base + `/expenses/${e.id}`,
            undefined,
            { "If-Match": "3" },
          )
        ).statusCode,
      ).toBe(200);
    } finally {
      await f.close();
    }
  });
});
describe("v1.2 activity, private methods and persistence", () => {
  it("persists ordered, paginated backend events atomically and deduplicates expense retries", async () => {
    const f = await setup();
    try {
      const key = { "Idempotency-Key": "same-expense" };
      const h = (
        await f.req(f.ali, "POST", f.base + "/expenses", f.expense(), key)
      ).json();
      await f.req(f.ali, "POST", f.base + "/expenses", f.expense(), key);
      const first = (
        await f.req(f.sara, "GET", f.base + "/activity?limit=2")
      ).json();
      expect(first.events).toHaveLength(2);
      expect(first.nextCursor).toBeTruthy();
      const second = (
        await f.req(
          f.sara,
          "GET",
          f.base + `/activity?limit=2&before=${first.nextCursor}`,
        )
      ).json();
      const all = [...first.events, ...second.events];
      expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
      expect(first.events[0].sequence).toBeGreaterThan(
        first.events[1].sequence,
      );
      const ev = all.find((e) => e.type === "expense.created");
      expect(ev.actorUserId).toBe(f.ali.me.id);
      expect(ev.resourceId).toBe(h.expenses[0].id);
      expect(Math.abs(Date.now() - Date.parse(ev.createdAt))).toBeLessThan(
        10000,
      );
      expect(all.filter((e) => e.type === "expense.created")).toHaveLength(1);
      expect(
        (await f.req(f.reza, "GET", f.base + "/activity")).statusCode,
      ).toBe(403);
      expect(
        (await f.req(f.sara, "DELETE", f.base + `/activity/${ev.id}`))
          .statusCode,
      ).toBe(404);
      const store = openDatabase(f.path);
      const stale = store.load(f.h.id)!;
      const originalTotal = calculate(stale).total;
      stale.expenses[0].title = "Should roll back";
      expect(() =>
        store.save(stale, [
          { actorUserId: "nonexistent-user", type: "expense.edited" },
        ]),
      ).toThrow();
      expect(store.load(f.h.id)!.expenses[0].title).toBe("Dinner");
      expect(calculate(store.load(f.h.id)!).total).toBe(originalTotal);
      store.db.close();
      await f.app.close();
      const restarted = await createApp({ database: f.path, demo: true });
      try {
        const r = await restarted.inject({
          method: "GET",
          url: f.base + "/activity",
          headers: { cookie: f.ali.cookie },
        });
        expect(r.json().events.some((e: any) => e.id === ev.id)).toBe(true);
        expect(
          (
            await restarted.inject({
              method: "GET",
              url: "/api/me",
              headers: { cookie: f.ali.cookie },
            })
          ).json().id,
        ).toBe(f.ali.me.id);
      } finally {
        await restarted.close();
      }
    } finally {
      await f.close();
    }
  });
  it("restricts method values to owners and related debtors, masks lists, and confirms partial settlements", async () => {
    const f = await setup();
    try {
      const secret = "1234 5678 9012 3456";
      const method = (
        await f.req(f.ali, "POST", "/api/receiving-methods", {
          kind: "card",
          value: secret,
          label: "My card",
          preferred: true,
          recipientName: "Ali",
        })
      ).json();
      expect(method.value).toBeUndefined();
      expect(method.maskedValue).toBe("•••• 3456");
      expect(
        (
          await f.req(f.sara, "PUT", `/api/receiving-methods/${method.id}`, {
            kind: "cash",
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await f.req(f.sara, "DELETE", `/api/receiving-methods/${method.id}`))
          .statusCode,
      ).toBe(403);
      expect(
        (await f.req(f.sara, "GET", `/api/receiving-methods/${method.id}`))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await f.req(
            f.sara,
            "GET",
            f.base + `/receiving/${f.aid}/${method.id}`,
          )
        ).statusCode,
      ).toBe(403);
      let h = (
        await f.req(f.ali, "POST", f.base + "/expenses", f.expense())
      ).json();
      expect(JSON.stringify(h)).not.toContain(secret);
      expect(h.preferences).toEqual({});
      expect(
        JSON.stringify(
          (
            await f.app.inject({
              method: "GET",
              url: `/api/invites/${h.inviteToken}`,
            })
          ).json(),
        ),
      ).not.toContain(secret);
      const list = (
        await f.req(f.sara, "GET", f.base + `/receiving/${f.aid}`)
      ).json();
      expect(list[0].value).toBeUndefined();
      expect(
        (
          await f.req(
            f.sara,
            "GET",
            f.base + `/receiving/${f.aid}/${method.id}`,
          )
        ).json().value,
      ).toBe(secret.replaceAll(" ", ""));
      expect(
        (
          await f.req(
            f.reza,
            "GET",
            f.base + `/receiving/${f.aid}/${method.id}`,
          )
        ).statusCode,
      ).toBe(403);
      const bank = (
        await f.req(f.ali, "POST", "/api/receiving-methods", {
          kind: "bank",
          value: "AM1234567890123",
          preferred: true,
        })
      ).json();
      expect(
        (await f.req(f.ali, "GET", "/api/receiving-methods"))
          .json()
          .filter((m: any) => m.preferred),
      ).toHaveLength(1);
      expect(
        (await f.req(f.ali, "POST", "/api/receiving-methods", { kind: "cash" }))
          .statusCode,
      ).toBe(200);
      expect(
        (
          await f.req(f.ali, "POST", "/api/receiving-methods", {
            kind: "wallet",
            value: "example-address",
            network: "test label",
          })
        ).statusCode,
      ).toBe(200);
      h = (
        await f.req(f.sara, "POST", f.base + "/settlements", {
          fromId: f.bid,
          toId: f.aid,
          amount: 2000,
          method: "bank",
          receivingMethodId: bank.id,
        })
      ).json();
      expect(calculate(h).transfers[0].amount).toBe(10000);
      const sid = h.settlements[0].id;
      expect(
        (
          await f.req(
            f.sara,
            "POST",
            f.base + `/settlements/${sid}/confirm`,
            {},
          )
        ).statusCode,
      ).toBe(403);
      h = (
        await f.req(f.ali, "POST", f.base + `/settlements/${sid}/confirm`, {})
      ).json();
      expect(calculate(h).transfers[0].amount).toBe(8000);
      const logs = (
        await f.req(f.ali, "GET", f.base + "/activity?limit=100")
      ).json().events;
      expect(JSON.stringify(logs)).not.toContain(secret);
      expect(JSON.stringify(logs)).not.toContain("AM1234567890123");
      expect(logs.some((e: any) => e.type === "settlement.partial")).toBe(true);
      expect(
        (
          await f.req(
            f.ali,
            "DELETE",
            f.base + `/expenses/${h.expenses[0].id}`,
            undefined,
            { "If-Match": "1" },
          )
        ).json().error,
      ).toBe("obligations");
      expect(
        (await f.req(f.ali, "DELETE", `/api/receiving-methods/${bank.id}`))
          .statusCode,
      ).toBe(200);
      expect(
        (await f.req(f.ali, "GET", f.base)).json().settlements[0]
          .receivingMethodId,
      ).toBe(bank.id);
    } finally {
      await f.close();
    }
  });
});
describe("v1.2 adjustment order and signed Telegram onboarding", () => {
  const e = (extra: Partial<Expense> = {}): Expense => ({
    id: "e",
    title: "Bill",
    payerId: "a",
    currency: "AMD",
    items: [
      {
        title: "Food",
        quantity: 1,
        unitPrice: 20000,
        allocations: [
          { memberId: "a", weight: 1 },
          { memberId: "b", weight: 1 },
        ],
      },
    ],
    tax: 1000,
    service: 0,
    tip: 0,
    discount: 0,
    createdAt: "",
    ...extra,
  });
  it("calculates the specified discount, tax and service example exactly", () => {
    const r = expenseShares(
      e({
        adjustments: {
          discount: { mode: "percentage", value: 1000 },
          service: { mode: "percentage", value: 500 },
        },
      }),
    );
    expect(r.total).toBe(19900);
    expect(r.adjustments).toEqual({
      discount: 2000,
      tax: 1000,
      service: 900,
      tip: 0,
    });
    expect(r.shares).toEqual({ a: 9950, b: 9950 });
  });
  it("combines percentage and fixed discounts before fees, rounding half up deterministically", () => {
    const r = expenseShares(
      e({
        discount: 1000,
        adjustments: {
          discount: { mode: "percentage", value: 1000 },
          tip: { mode: "percentage", value: 125 },
        },
      }),
    );
    expect(r.adjustments.discount).toBe(3000);
    expect(r.adjustments.tip).toBe(213);
    expect(r.total).toBe(18213);
    expect(Object.values(r.shares).reduce((a, b) => a + b, 0)).toBe(r.total);
  });
  it("rejects discounts above subtotal, invalid percentages and unsafe amounts", () => {
    expect(() => expenseShares(e({ discount: 20001 }))).toThrow();
    expect(() =>
      expenseShares(
        e({ adjustments: { tax: { mode: "percentage", value: 10001 } } }),
      ),
    ).toThrow();
    expect(() =>
      expenseShares(
        e({ adjustments: { tip: { mode: "percentage", value: NaN } } }),
      ),
    ).toThrow();
    expect(() => expenseShares(e({ tax: Infinity }))).toThrow();
  });
  it("supports equal adjustment allocation and preserves historical fixed amounts", () => {
    const r = expenseShares(e({ adjustmentAllocation: "equal", tip: 101 }));
    expect(Object.values(r.shares).reduce((a, b) => a + b, 0)).toBe(21101);
    expect(expenseShares(e()).total).toBe(21000);
  });
  it("uses internal IDs for verified Telegram identity and keeps the confirmed display name", async () => {
    const app = await createApp({
      database: ":memory:",
      production: true,
      botToken: "fixture-token",
    });
    const signed = (name: string) => {
      const p = new URLSearchParams({
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({
          id: 555,
          first_name: name,
          last_name: "Person",
          username: "fixture_user",
          photo_url: "https://example.com/avatar.jpg",
        }),
      });
      const data = [...p.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
      const key = createHmac("sha256", "WebAppData")
        .update("fixture-token")
        .digest();
      p.set("hash", createHmac("sha256", key).update(data).digest("hex"));
      return { authorization: "tma " + p.toString() };
    };
    try {
      const me = (
        await app.inject({
          method: "GET",
          url: "/api/me",
          headers: signed("Telegram"),
        })
      ).json();
      expect(me.id).not.toBe("tg-555");
      expect(me.telegramId).toBe("555");
      expect(me.onboarded).toBe(false);
      expect(me.username).toBe("fixture_user");
      expect(me.firstName).toBe("Telegram");
      expect(me.lastName).toBe("Person");
      expect(me.avatarUrl).toContain("avatar.jpg");
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/api/me",
            headers: signed("Telegram"),
            payload: { name: "Chosen name" },
          })
        ).statusCode,
      ).toBe(200);
      const returning = (
        await app.inject({
          method: "GET",
          url: "/api/me",
          headers: signed("Changed remotely"),
        })
      ).json();
      expect(returning.name).toBe("Chosen name");
      expect(returning.id).toBe(me.id);
      expect(returning.onboarded).toBe(true);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/auth/guest",
            payload: { name: "No" },
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await app.close();
    }
  });
});
