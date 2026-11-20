import { it, expect, describe } from "vitest";
import { createApp } from "../server/app";
import { calculate } from "../shared/engine";
import { verifyTelegram } from "../server/auth";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
async function guest(app: Awaited<ReturnType<typeof createApp>>, name = "Ali") {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/guest",
    payload: { name },
  });
  return { cookie: String(r.headers["set-cookie"]).split(";")[0] };
}
const headers = (who = "ali") => ({ authorization: `Demo ${who}` });
describe("API and persistence", () => {
  it("creates itemized expenses, joins and revokes invites, enforces authorization, settles and persists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dong-test-"));
    const path = join(dir, "test.sqlite");
    let app = await createApp({ database: path, demo: true });
    try {
      const sessions: Record<string, Record<string, string>> = {};
      const req = async (
        method: any,
        url: string,
        payload?: any,
        who = "ali",
      ) => {
        sessions[who] ||= await guest(app, who);
        return app.inject({ method, url, headers: sessions[who], payload });
      };
      expect(
        (await app.inject({ method: "GET", url: "/api/hangouts" })).statusCode,
      ).toBe(401);
      let r = await req("POST", "/api/hangouts", {
        title: "Dinner",
        currency: "AMD",
        date: "2026-11-20",
      });
      expect(r.statusCode).toBe(200);
      let h = r.json();
      const base = `/api/hangouts/${h.id}`;
      const aid = h.members[0].id;
      expect((await req("GET", base, undefined, "stranger")).statusCode).toBe(
        403,
      );
      expect(
        (
          await req("GET", `/api/invites/${h.inviteToken}`, undefined, "sara")
        ).json().title,
      ).toBe("Dinner");
      h = (
        await req("POST", `/api/invites/${h.inviteToken}/join`, {}, "sara")
      ).json();
      const bid = h.members[1].id;
      expect(
        (
          await req("POST", `/api/invites/${h.inviteToken}/join`, {}, "sara")
        ).json().members,
      ).toHaveLength(2);
      const prev = h.inviteToken;
      h = (await req("POST", base + "/invite", {})).json();
      expect(
        (await req("GET", `/api/invites/${prev}`, undefined, "nima"))
          .statusCode,
      ).toBe(404);
      const body = {
        title: "Meal",
        payerId: aid,
        currency: "AMD",
        items: [
          {
            title: "Pizza",
            quantity: 1,
            unitPrice: 3500,
            allocations: [{ memberId: aid, weight: 1 }],
          },
          {
            title: "Pasta",
            quantity: 1,
            unitPrice: 4000,
            allocations: [{ memberId: bid, weight: 1 }],
          },
          {
            title: "Fries",
            quantity: 1,
            unitPrice: 1501,
            allocations: [
              { memberId: aid, weight: 1 },
              { memberId: bid, weight: 1 },
            ],
          },
        ],
        tax: 0,
        tip: 100,
        service: 0,
        discount: 0,
      };
      r = await req("POST", base + "/expenses", body);
      expect(r.statusCode).toBe(200);
      h = r.json();
      let debt = calculate(h).transfers[0].amount;
      expect(calculate(h).total).toBe(9101);
      expect(
        (await req("POST", base + "/expenses", { ...body, currency: "USD" }))
          .statusCode,
      ).toBe(400);
      expect(
        (
          await req("POST", base + "/expenses", {
            ...body,
            items: [{ ...body.items[0], unitPrice: -1 }],
          })
        ).statusCode,
      ).toBe(400);
      h = (
        await req("PUT", base + `/expenses/${h.expenses[0].id}`, {
          ...body,
          tip: 0,
          expectedRevision: h.expenses[0].revision,
        })
      ).json();
      debt = calculate(h).transfers[0].amount;
      expect((await req("DELETE", base + `/members/${bid}`)).json().error).toBe(
        "obligations",
      );
      expect(
        (
          await req(
            "POST",
            base + "/settlements",
            { fromId: bid, toId: aid, amount: debt + 1, method: "cash" },
            "sara",
          )
        ).json().error,
      ).toBe("overpayment");
      expect(
        (
          await req("POST", base + "/settlements", {
            fromId: bid,
            toId: aid,
            amount: 100,
            method: "cash",
          })
        ).statusCode,
      ).toBe(403);
      h = (
        await req(
          "POST",
          base + "/settlements",
          { fromId: bid, toId: aid, amount: 100, method: "cash" },
          "sara",
        )
      ).json();
      expect(calculate(h).transfers[0].amount).toBe(debt);
      const sid = h.settlements[0].id;
      expect(
        (await req("POST", base + `/settlements/${sid}/confirm`, {}, "sara"))
          .statusCode,
      ).toBe(403);
      h = (await req("POST", base + `/settlements/${sid}/confirm`, {})).json();
      expect(calculate(h).transfers[0].amount).toBe(debt - 100);
      h = (await req("POST", base + `/settlements/${sid}/confirm`, {})).json();
      expect(calculate(h).transfers[0].amount).toBe(debt - 100);
      expect(
        (
          await req("PUT", base + "/preferences", {
            memberId: bid,
            method: "card",
            details: "1234",
          })
        ).statusCode,
      ).toBe(403);
      await app.close();
      app = await createApp({ database: path, demo: true });
      const persisted = (await req("GET", base)).json();
      expect(persisted.expenses.length).toBe(1);
      expect(persisted.settlements[0].status).toBe("confirmed");
      expect(persisted.members.length).toBe(2);
    } finally {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("disables demo identity and seeding in production", async () => {
    const app = await createApp({
      database: ":memory:",
      demo: true,
      production: true,
    });
    try {
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/me",
            headers: headers(),
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (await app.inject({ method: "GET", url: "/api/config" })).json().demo,
      ).toBe(false);
    } finally {
      await app.close();
    }
  });
  it("prevents duplicate expense submission with a stable key", async () => {
    const app = await createApp({ database: ":memory:", demo: true });
    const auth = await guest(app);
    try {
      const h = (
        await app.inject({
          method: "POST",
          url: "/api/demo/seed",
          headers: auth,
          payload: {},
        })
      ).json();
      const payload = { ...h.expenses[0], title: "Retry" };
      for (let i = 0; i < 2; i++)
        expect(
          (
            await app.inject({
              method: "POST",
              url: `/api/hangouts/${h.id}/expenses`,
              headers: { ...auth, "idempotency-key": "stable-key" },
              payload,
            })
          ).statusCode,
        ).toBe(200);
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/api/hangouts/${h.id}`,
            headers: auth,
          })
        ).json().expenses,
      ).toHaveLength(3);
    } finally {
      await app.close();
    }
  });
});
describe("Telegram authentication", () => {
  function signed(date: number, token = "test-token") {
    const p = new URLSearchParams({
      auth_date: String(date),
      user: JSON.stringify({ id: 123, first_name: "Ali" }),
    });
    const data = [...p.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const key = createHmac("sha256", "WebAppData").update(token).digest();
    p.set("hash", createHmac("sha256", key).update(data).digest("hex"));
    return p.toString();
  }
  it("verifies authentic data", () =>
    expect(verifyTelegram(signed(10000), "test-token", 10001).id).toBe(123));
  it("rejects tampering, expired and future data", () => {
    expect(() =>
      verifyTelegram(signed(10000).replace("Ali", "Eve"), "test-token", 10001),
    ).toThrow();
    expect(() => verifyTelegram(signed(10000), "test-token", 20000)).toThrow();
    expect(() => verifyTelegram(signed(10000), "test-token", 9000)).toThrow();
    expect(() => verifyTelegram(signed(10000), "wrong", 10001)).toThrow();
  });
});
