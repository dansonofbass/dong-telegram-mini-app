import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { openDatabase } from "./db";
import { verifyTelegram } from "./auth";
import {
  calculate,
  expenseShares,
  type Hangout,
  type Expense,
} from "../shared/engine";
const id = () => randomUUID();
const token = () => randomBytes(24).toString("base64url");
const text = z.string().trim().min(1).max(100);
const amount = z.number().int().min(0).max(1e12);
const expenseSchema = z.object({
  title: text,
  payerId: text,
  currency: z.enum(["AMD", "USD", "EUR", "USDT"]),
  items: z
    .array(
      z.object({
        title: text,
        quantity: z.number().int().min(1).max(10000),
        unitPrice: amount,
        allocations: z
          .array(
            z.object({
              memberId: text,
              weight: z.number().int().min(1).max(1e9),
            }),
          )
          .min(1)
          .max(50),
      }),
    )
    .min(1)
    .max(100),
  tax: amount,
  service: amount,
  tip: amount,
  discount: amount,
});
export async function createApp(
  options: {
    database?: string;
    demo?: boolean;
    botToken?: string;
    production?: boolean;
  } = {},
) {
  const production =
    options.production ?? process.env.NODE_ENV === "production";
  const demo =
    !production && (options.demo ?? process.env.DEMO_MODE !== "false");
  const store = openDatabase(
    options.database || `${process.env.DATA_DIR || "./data"}/dong.sqlite`,
  );
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024 });
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  const fail = (code: string, status = 400) => {
    throw Object.assign(Error(code), { statusCode: status });
  };
  const user = (r: any) => r.user as { id: string; name: string };
  const get = (r: any, owner = false) => {
    const h = store.load(r.params.id);
    if (!h || !h.members.some((m) => m.userId === user(r).id))
      return fail("forbidden", 403);
    if (owner && h.ownerId !== user(r).id) fail("forbidden", 403);
    return h;
  };
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (r, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin");
    if (
      !r.url.startsWith("/api/") ||
      r.url.startsWith("/api/health") ||
      r.url.startsWith("/api/config")
    )
      return;
    let u: { id: string; name: string };
    const auth = r.headers.authorization || "";
    if (demo && auth.startsWith("Demo ")) {
      const who = auth.slice(5);
      if (!/^[a-zA-Z0-9-]{1,64}$/.test(who)) return fail("auth", 401);
      u = {
        id: `demo-${who}`,
        name:
          (
            { ali: "Ali", sara: "Sara", reza: "Reza", nima: "Nima" } as Record<
              string,
              string
            >
          )[who] || "Guest",
      };
    } else {
      try {
        const tg = verifyTelegram(
          auth.replace(/^tma /, ""),
          options.botToken || process.env.BOT_TOKEN || "",
        );
        if (
          !auth.startsWith("tma ") ||
          !(options.botToken || process.env.BOT_TOKEN)
        )
          throw Error();
        u = {
          id: `tg-${tg.id}`,
          name: `${tg.first_name} ${tg.last_name || ""}`.trim(),
        };
      } catch {
        return fail("auth", 401);
      }
    }
    (r as any).user = u;
    store.db
      .prepare(
        "INSERT INTO users(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
      )
      .run(u.id, u.name);
  });
  app.setErrorHandler((e: any, _r, reply) => {
    const known = e instanceof z.ZodError ? "validation" : e.message;
    const status = e instanceof z.ZodError ? 400 : e.statusCode || 400;
    reply
      .code(status >= 500 ? 500 : status)
      .send({
        error:
          status >= 500
            ? "server"
            : [
                  "forbidden",
                  "auth",
                  "invalidInvite",
                  "obligations",
                  "overpayment",
                  "duplicate",
                  "amount",
                  "allocation",
                  "currency",
                  "member",
                  "validation",
                  "settlement",
                ].includes(known)
              ? known
              : "validation",
      });
  });
  app.get("/api/health", () => ({ ok: true }));
  app.get("/api/config", () => ({
    demo,
    botUsername: process.env.BOT_USERNAME || "",
    appShortName: process.env.APP_SHORT_NAME || "",
  }));
  app.get("/api/me", (r) => ({ ...user(r), demo }));
  app.get("/api/hangouts", (r) => {
    const rows = store.db
      .prepare(
        "SELECT h.document FROM hangouts h JOIN members m ON h.id=m.hangout_id WHERE m.user_id=? ORDER BY h.created_at DESC",
      )
      .all(user(r).id) as { document: string }[];
    return rows.map((row) => JSON.parse(row.document));
  });
  app.post("/api/hangouts", (r) => {
    const b = z
      .object({
        title: text,
        description: z.string().max(500).default(""),
        currency: z.enum(["AMD", "USD", "EUR", "USDT"]).default("AMD"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        icon: z.string().max(10).default("dinner"),
      })
      .parse(r.body);
    const h: Hangout = {
      ...b,
      id: id(),
      ownerId: user(r).id,
      members: [{ id: id(), name: user(r).name, userId: user(r).id }],
      expenses: [],
      settlements: [],
      inviteToken: token(),
      preferences: {},
    };
    store.save(h);
    return h;
  });
  app.get("/api/hangouts/:id", (r) => get(r));
  app.post("/api/hangouts/:id/members", (r) => {
    const h = get(r, true);
    if (!demo) fail("forbidden", 403);
    if (h.members.length >= 50) fail("validation");
    h.members.push({
      id: id(),
      name: text.parse((r.body as any)?.name),
      userId: null,
    });
    store.save(h);
    return h;
  });
  app.delete("/api/hangouts/:id/members/:memberId", (r) => {
    const h = get(r, true);
    const mid = (r.params as any).memberId;
    const m = h.members.find((m) => m.id === mid);
    if (!m || m.userId === h.ownerId) fail("forbidden", 403);
    if (
      h.expenses.some(
        (e) =>
          e.payerId === mid ||
          e.items.some((i) => i.allocations.some((a) => a.memberId === mid)),
      ) ||
      h.settlements.some((s) => s.fromId === mid || s.toId === mid)
    )
      fail("obligations");
    h.members = h.members.filter((m) => m.id !== mid);
    delete h.preferences[mid];
    store.save(h);
    return h;
  });
  app.post("/api/hangouts/:id/invite", (r) => {
    const h = get(r, true);
    h.inviteToken = token();
    store.save(h);
    return h;
  });
  app.get("/api/invites/:token", (r) => {
    const inv = store.db
      .prepare("SELECT hangout_id FROM invitations WHERE token=? AND revoked=0")
      .get((r.params as any).token) as any;
    const h: Hangout | undefined = inv ? store.load(inv.hangout_id) : undefined;
    if (!h) fail("invalidInvite", 404);
    return { title: h!.title, memberCount: h!.members.length };
  });
  app.post("/api/invites/:token/join", (r) => {
    const inv = store.db
      .prepare("SELECT hangout_id FROM invitations WHERE token=? AND revoked=0")
      .get((r.params as any).token) as any;
    const h: Hangout | undefined = inv ? store.load(inv.hangout_id) : undefined;
    if (!h) fail("invalidInvite", 404);
    if (!h!.members.some((m) => m.userId === user(r).id)) {
      if (h!.members.length >= 50) fail("validation");
      h!.members.push({ id: id(), name: user(r).name, userId: user(r).id });
      store.save(h!);
    }
    return h;
  });
  const saveExpense = (r: any, edit: boolean) => {
    const h = get(r);
    const b = expenseSchema.parse(r.body);
    if (b.currency !== h.currency) fail("currency");
    const ids = h.members.map((m) => m.id);
    if (
      !ids.includes(b.payerId) ||
      b.items.some((i) => i.allocations.some((a) => !ids.includes(a.memberId)))
    )
      fail("member");
    const e: Expense = {
      ...b,
      id: edit ? r.params.expenseId : id(),
      createdAt: new Date().toISOString(),
    };
    expenseShares(e);
    const key = r.headers["idempotency-key"];
    if (!edit && key) {
      const old = store.db
        .prepare("SELECT response FROM submissions WHERE user_id=? AND key=?")
        .get(user(r).id, key) as any;
      if (old) return get(r);
    }
    if (edit) {
      if (!h.expenses.some((x) => x.id === e.id)) fail("validation");
      h.expenses = h.expenses.map((x) => (x.id === e.id ? e : x));
    } else h.expenses.push(e);
    calculate(h);
    store.save(h);
    if (key && !edit)
      store.db
        .prepare("INSERT INTO submissions(user_id,key,response) VALUES(?,?,?)")
        .run(user(r).id, key, e.id);
    return h;
  };
  app.post("/api/hangouts/:id/expenses", (r) => saveExpense(r, false));
  app.put("/api/hangouts/:id/expenses/:expenseId", (r) => saveExpense(r, true));
  app.delete("/api/hangouts/:id/expenses/:expenseId", (r) => {
    const h = get(r);
    h.expenses = h.expenses.filter((e) => e.id !== (r.params as any).expenseId);
    store.save(h);
    return h;
  });
  app.put("/api/hangouts/:id/preferences", (r) => {
    const h = get(r);
    const b = z
      .object({
        memberId: text,
        method: z.enum(["card", "wallet", "cash", "other"]),
        details: z.string().trim().max(150),
      })
      .parse(r.body);
    if (!h.members.some((m) => m.id === b.memberId && m.userId === user(r).id))
      fail("forbidden", 403);
    h.preferences[b.memberId] = { method: b.method, details: b.details };
    store.save(h);
    return h;
  });
  app.post("/api/hangouts/:id/settlements", (r) => {
    const h = get(r);
    const b = z
      .object({
        fromId: text,
        toId: text,
        amount: amount.refine((n) => n > 0),
        method: z.enum(["card", "wallet", "cash", "other"]),
      })
      .parse(r.body);
    if (!h.members.some((m) => m.id === b.fromId && m.userId === user(r).id))
      fail("forbidden", 403);
    if (
      h.settlements.some(
        (s) =>
          s.fromId === b.fromId &&
          s.toId === b.toId &&
          s.amount === b.amount &&
          s.method === b.method &&
          s.status !== "confirmed",
      )
    )
      fail("duplicate");
    const transfer = calculate(h).transfers.find(
      (t) => t.fromId === b.fromId && t.toId === b.toId,
    );
    const pending = h.settlements
      .filter(
        (s) =>
          s.fromId === b.fromId &&
          s.toId === b.toId &&
          s.status !== "confirmed",
      )
      .reduce((n, s) => n + s.amount, 0);
    if (!transfer || b.amount + pending > transfer.amount) fail("overpayment");
    h.settlements.push({
      ...b,
      id: id(),
      status: "marked",
      createdAt: new Date().toISOString(),
    });
    store.save(h);
    return h;
  });
  app.post("/api/hangouts/:id/settlements/:settlementId/confirm", (r) => {
    const h = get(r);
    const s = h.settlements.find(
      (s) => s.id === (r.params as any).settlementId,
    );
    if (
      !s ||
      !h.members.some((m) => m.id === s.toId && m.userId === user(r).id)
    )
      fail("forbidden", 403);
    if (s!.status === "confirmed") return h;
    const transfer = calculate(h).transfers.find(
      (t) => t.fromId === s!.fromId && t.toId === s!.toId,
    );
    if (!transfer || s!.amount > transfer.amount) fail("overpayment");
    s!.status = "confirmed";
    store.save(h);
    return h;
  });
  app.post("/api/demo/seed", (r) => {
    if (!demo) fail("forbidden", 403);
    const existing = store.db
      .prepare("SELECT id FROM hangouts WHERE owner_id=? LIMIT 1")
      .get(user(r).id) as any;
    if (existing) return store.load(existing.id);
    const names = ["Ali", "Sara", "Reza", "Nima"];
    for (const n of names)
      store.db
        .prepare("INSERT OR IGNORE INTO users(id,name) VALUES(?,?)")
        .run(`demo-${n.toLowerCase()}`, n);
    const members = names.map((name) => ({
      id: id(),
      name,
      userId: `demo-${name.toLowerCase()}`,
    }));
    const h: Hangout = {
      id: id(),
      title: "Friday dinner",
      description:
        "Good food, better company. A little evening at our favorite table.",
      currency: "AMD",
      date: "2026-11-20",
      icon: "dinner",
      ownerId: user(r).id,
      members,
      expenses: [],
      settlements: [],
      inviteToken: token(),
      preferences: {},
    };
    const item = (title: string, price: number, people: number[]) => ({
      title,
      quantity: 1,
      unitPrice: price,
      allocations: people.map((i) => ({ memberId: members[i].id, weight: 1 })),
    });
    h.expenses = [
      {
        id: id(),
        title: "Dinner at Lavash",
        payerId: members[0].id,
        currency: "AMD",
        items: [
          item("Margherita pizza", 3500, [0]),
          item("Creamy pasta", 4000, [1]),
          item("Garden salad", 2000, [2]),
          item("Grilled chicken", 4500, [3]),
          item("Fries for the table", 1500, [0, 1, 2, 3]),
        ],
        tax: 0,
        service: 0,
        tip: 1000,
        discount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: id(),
        title: "Ride home",
        payerId: members[1].id,
        currency: "AMD",
        items: [item("Taxi", 2400, [0, 1, 2, 3])],
        tax: 0,
        service: 0,
        tip: 0,
        discount: 0,
        createdAt: new Date().toISOString(),
      },
    ];
    store.save(h);
    return h;
  });
  app.addHook("onClose", () => store.db.close());
  return app;
}
