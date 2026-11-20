import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { openDatabase } from "./db";
import { verifyTelegram } from "./auth";
import { registerV12 } from "./v12";
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
  adjustments: z
    .partialRecord(
      z.enum(["tax", "service", "tip", "discount"]),
      z.object({ mode: z.enum(["fixed", "percentage"]), value: amount }),
    )
    .optional(),
  adjustmentAllocation: z.enum(["proportional", "equal"]).optional(),
  expectedRevision: z.number().int().positive().optional(),
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
  const present = (h: Hangout) => ({ ...h, preferences: {} });
  const event = (
    r: any,
    type: string,
    resourceId?: string,
    metadata: Record<string, string | number | boolean> = {},
  ) => ({ actorUserId: user(r).id, type, resourceId, metadata });
  const persist = (
    r: any,
    h: Hangout,
    type: string,
    resourceId?: string,
    metadata: Record<string, string | number | boolean> = {},
  ) => {
    store.save(h, [event(r, type, resourceId, metadata)]);
    return present(h);
  };
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const session = (reply: any, uid: string) => {
    const secret = token();
    store.db
      .prepare(
        "INSERT INTO guest_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
      )
      .run(
        hash(secret),
        uid,
        new Date(Date.now() + 30 * 86400000).toISOString(),
      );
    reply.header(
      "Set-Cookie",
      `dong_session=${secret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    );
  };
  const identity = (row: any) => ({
    id: row.id,
    name: row.name,
    demo: demo && !row.telegram_id,
    onboarded: !!row.onboarded,
    username: row.username || "",
    avatarUrl: row.avatar_url || "",
    telegramId: row.telegram_id || null,
    firstName: row.first_name,
    lastName: row.last_name,
  });
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (r, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin");
    if (
      !r.url.startsWith("/api/") ||
      r.url.startsWith("/api/health") ||
      r.url.startsWith("/api/config") ||
      r.url.split("?")[0] === "/api/auth/guest" ||
      (/^\/api\/invites\/[^/]+(?:\?.*)?$/.test(r.url) && r.method === "GET")
    )
      return;
    if (
      !["GET", "HEAD"].includes(r.method) &&
      r.headers.origin &&
      r.headers.origin !==
        (process.env.PUBLIC_URL
          ? new URL(process.env.PUBLIC_URL).origin
          : `${r.protocol}://${r.headers.host}`)
    )
      return fail("forbidden", 403);
    let u: any;
    const auth = r.headers.authorization || "";
    if (demo && !auth.startsWith("tma ")) {
      const secret =
        (r.headers.cookie || "")
          .split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("dong_session="))
          ?.slice(13) || "";
      u = store.db
        .prepare(
          "SELECT u.* FROM users u JOIN guest_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
        )
        .get(hash(secret), new Date().toISOString());
      if (!u) return fail("auth", 401);
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
        u = store.db
          .prepare("SELECT * FROM users WHERE telegram_id=?")
          .get(String(tg.id));
        if (!u) {
          const uid = id();
          store.db
            .prepare(
              "INSERT INTO users(id,name,telegram_id,username,avatar_url,onboarded) VALUES(?,?,?,?,?,0)",
            )
            .run(
              uid,
              `${tg.first_name} ${tg.last_name || ""}`.trim().slice(0, 100),
              String(tg.id),
              (tg.username || "").slice(0, 100),
              typeof tg.photo_url === "string" &&
                tg.photo_url.startsWith("https://")
                ? tg.photo_url.slice(0, 1000)
                : "",
            );
          u = store.db.prepare("SELECT * FROM users WHERE id=?").get(uid);
        }
        store.db
          .prepare(
            "UPDATE users SET first_name=?,last_name=?,username=?,avatar_url=? WHERE id=?",
          )
          .run(
            tg.first_name.slice(0, 100),
            (tg.last_name || "").slice(0, 100),
            (tg.username || "").slice(0, 100),
            typeof tg.photo_url === "string" &&
              tg.photo_url.startsWith("https://")
              ? tg.photo_url.slice(0, 1000)
              : "",
            u.id,
          );
        u = store.db.prepare("SELECT * FROM users WHERE id=?").get(u.id);
      } catch {
        return fail("auth", 401);
      }
    }
    (r as any).user = identity(u);
  });
  app.setErrorHandler((e: any, _r, reply) => {
    const known = e instanceof z.ZodError ? "validation" : e.message;
    const status = e instanceof z.ZodError ? 400 : e.statusCode || 400;
    reply.code(status >= 500 ? 500 : status).send({
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
                "conflict",
                "percentage",
                "notConfigured",
                "onboarding",
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
  app.post("/api/auth/guest", (r, reply) => {
    if (!demo) fail("forbidden", 403);
    if (
      r.headers.origin &&
      r.headers.origin !==
        (process.env.PUBLIC_URL
          ? new URL(process.env.PUBLIC_URL).origin
          : `${r.protocol}://${r.headers.host}`)
    )
      fail("forbidden", 403);
    const b = z.object({ name: text }).parse(r.body);
    const uid = id();
    store.db
      .prepare("INSERT INTO users(id,name,onboarded) VALUES(?,?,1)")
      .run(uid, b.name);
    session(reply, uid);
    return identity(
      store.db.prepare("SELECT * FROM users WHERE id=?").get(uid),
    );
  });
  app.get("/api/me", (r) => (r as any).user);
  app.put("/api/me", (r) => {
    const name = text.parse((r.body as any)?.name);
    store.db.exec("BEGIN IMMEDIATE");
    try {
      store.db
        .prepare("UPDATE users SET name=?,onboarded=1 WHERE id=?")
        .run(name, user(r).id);
      const rows = store.db
        .prepare(
          "SELECT h.id FROM hangouts h JOIN members m ON m.hangout_id=h.id WHERE m.user_id=?",
        )
        .all(user(r).id) as any[];
      for (const row of rows) {
        const h = store.load(row.id)!;
        h.members = h.members.map((m) =>
          m.userId === user(r).id ? { ...m, name } : m,
        );
        h.version = (h.version || 0) + 1;
        store.db
          .prepare(
            "UPDATE hangouts SET document=?,version=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .run(JSON.stringify(h), h.version, h.id);
        store.db
          .prepare("UPDATE members SET name=? WHERE hangout_id=? AND user_id=?")
          .run(name, h.id, user(r).id);
      }
      store.db.exec("COMMIT");
    } catch (e) {
      store.db.exec("ROLLBACK");
      throw e;
    }
    return identity(
      store.db.prepare("SELECT * FROM users WHERE id=?").get(user(r).id),
    );
  });
  app.get("/api/hangouts", (r) => {
    const rows = store.db
      .prepare(
        "SELECT h.document FROM hangouts h JOIN members m ON h.id=m.hangout_id WHERE m.user_id=? ORDER BY h.created_at DESC",
      )
      .all(user(r).id) as { document: string }[];
    return rows.map((row) => present(JSON.parse(row.document)));
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
    if (!(r as any).user.onboarded) fail("onboarding");
    return persist(r, h, "hangout.created", h.id);
  });
  app.get("/api/hangouts/:id", (r) => present(get(r)));
  app.post("/api/hangouts/:id/members", (r) => {
    const h = get(r, true);
    if (!demo || !h.demoSample) fail("forbidden", 403);
    if (h.members.length >= 50) fail("validation");
    h.members.push({
      id: id(),
      name: text.parse((r.body as any)?.name),
      userId: null,
    });
    return persist(r, h, "member.joined", h.members.at(-1)!.id, {
      name: h.members.at(-1)!.name,
    });
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
    return persist(r, h, "member.removed", mid, { name: m!.name });
  });
  app.post("/api/hangouts/:id/invite", (r) => {
    const h = get(r, true);
    h.inviteToken = token();
    return persist(r, h, "invite.regenerated");
  });
  app.get("/api/invites/:token", (r) => {
    const inv = store.db
      .prepare(
        "SELECT hangout_id FROM invitations WHERE token=? AND revoked=0 AND (expires_at IS NULL OR expires_at>?)",
      )
      .get((r.params as any).token, new Date().toISOString()) as any;
    const h: Hangout | undefined = inv ? store.load(inv.hangout_id) : undefined;
    if (!h) fail("invalidInvite", 404);
    return { title: h!.title, memberCount: h!.members.length };
  });
  app.post("/api/invites/:token/join", (r) => {
    const inv = store.db
      .prepare(
        "SELECT hangout_id FROM invitations WHERE token=? AND revoked=0 AND (expires_at IS NULL OR expires_at>?)",
      )
      .get((r.params as any).token, new Date().toISOString()) as any;
    const h: Hangout | undefined = inv ? store.load(inv.hangout_id) : undefined;
    if (!h) fail("invalidInvite", 404);
    if (!h!.members.some((m) => m.userId === user(r).id)) {
      if (h!.members.length >= 50) fail("validation");
      h!.members.push({ id: id(), name: user(r).name, userId: user(r).id });
      if (!(r as any).user.onboarded) fail("onboarding");
      store.save(h!, [
        event(r, "member.joined", h!.members.at(-1)!.id, {
          name: user(r).name,
        }),
      ]);
    }
    return present(h!);
  });
  const saveExpense = (r: any, edit: boolean) => {
    const h = get(r);
    const oldExpense = edit
      ? h.expenses.find((e) => e.id === r.params.expenseId)
      : undefined;
    if (edit && !oldExpense) fail("validation");
    if (edit && oldExpense!.createdByUserId !== user(r).id) {
      if (h.ownerId !== user(r).id || r.headers["x-admin-action"] !== "true")
        fail("forbidden", 403);
    }
    const b = expenseSchema.parse(r.body);
    if (edit && b.expectedRevision !== (oldExpense!.revision || 1))
      fail("conflict", 409);
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
      createdByUserId: oldExpense?.createdByUserId || user(r).id,
      revision: (oldExpense?.revision || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    if (oldExpense) e.createdAt = oldExpense.createdAt;
    expenseShares(e);
    const key = r.headers["idempotency-key"];
    if (!edit && key) {
      const old = store.db
        .prepare("SELECT response FROM submissions WHERE user_id=? AND key=?")
        .get(user(r).id, key) as any;
      if (old) return present(get(r));
    }
    if (edit) {
      if (!h.expenses.some((x) => x.id === e.id)) fail("validation");
      h.expenses = h.expenses.map((x) => (x.id === e.id ? e : x));
    } else h.expenses.push(e);
    calculate(h);
    const metadata = {
      title: e.title,
      amount: expenseShares(e).total,
      currency: h.currency,
      administrative: !!(edit && oldExpense?.createdByUserId !== user(r).id),
    };
    const events = [
      event(r, edit ? "expense.edited" : "expense.created", e.id, metadata),
    ];
    if (oldExpense?.payerId !== e.payerId && oldExpense)
      events.push(event(r, "expense.payerChanged", e.id));
    if (
      oldExpense &&
      JSON.stringify(oldExpense.items.map((i) => i.allocations)) !==
        JSON.stringify(e.items.map((i) => i.allocations))
    )
      events.push(event(r, "expense.allocationsChanged", e.id));
    if (
      oldExpense &&
      (["tax", "discount", "tip", "service"] as const).some(
        (k) =>
          oldExpense[k] !== e[k] ||
          JSON.stringify(oldExpense.adjustments?.[k]) !==
            JSON.stringify(e.adjustments?.[k]),
      )
    )
      events.push(event(r, "expense.adjustmentsChanged", e.id));
    store.save(
      h,
      events,
      key && !edit
        ? { userId: user(r).id, key: String(key).slice(0, 100), response: e.id }
        : undefined,
    );
    return present(h);
  };
  app.post("/api/hangouts/:id/expenses", (r) => saveExpense(r, false));
  app.put("/api/hangouts/:id/expenses/:expenseId", (r) => saveExpense(r, true));
  app.delete("/api/hangouts/:id/expenses/:expenseId", (r) => {
    const h = get(r);
    const e = h.expenses.find((e) => e.id === (r.params as any).expenseId);
    if (!e) fail("validation");
    if (
      e!.createdByUserId !== user(r).id &&
      (h.ownerId !== user(r).id || r.headers["x-admin-action"] !== "true")
    )
      fail("forbidden", 403);
    if (Number(r.headers["if-match"]) !== (e!.revision || 1))
      fail("conflict", 409);
    if (h.settlements.some((s) => s.status === "confirmed"))
      fail("obligations");
    h.expenses = h.expenses.filter((e) => e.id !== (r.params as any).expenseId);
    return persist(r, h, "expense.deleted", e!.id, {
      title: e!.title,
      administrative: e!.createdByUserId !== user(r).id,
    });
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
    return persist(r, h, "receiving.updated");
  });
  app.post("/api/hangouts/:id/settlements", (r) => {
    const h = get(r);
    const b = z
      .object({
        fromId: text,
        toId: text,
        amount: amount.refine((n) => n > 0),
        method: z.enum(["card", "bank", "wallet", "cash", "other"]),
        receivingMethodId: text.optional(),
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
    if (b.method !== "cash") {
      const m = store.db
        .prepare(
          "SELECT * FROM receiving_methods WHERE id=? AND user_id=? AND kind=?",
        )
        .get(
          b.receivingMethodId || "",
          h.members.find((m) => m.id === b.toId)?.userId || "",
          b.method,
        );
      if (!m) fail("forbidden", 403);
    }
    h.settlements.push({
      ...b,
      id: id(),
      status: "marked",
      createdAt: new Date().toISOString(),
    });
    return persist(
      r,
      h,
      b.amount < transfer!.amount ? "settlement.partial" : "settlement.marked",
      h.settlements.at(-1)!.id,
      { amount: b.amount, currency: h.currency },
    );
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
    if (s!.status === "confirmed") return present(h);
    const transfer = calculate(h).transfers.find(
      (t) => t.fromId === s!.fromId && t.toId === s!.toId,
    );
    if (!transfer || s!.amount > transfer.amount) fail("overpayment");
    s!.status = "confirmed";
    return persist(r, h, "settlement.confirmed", s!.id, {
      amount: s!.amount,
      currency: h.currency,
    });
  });
  app.post("/api/demo/seed", (r) => {
    if (!demo) fail("forbidden", 403);
    const existing = store.db
      .prepare(
        "SELECT id FROM hangouts WHERE owner_id=? AND json_extract(document,'$.demoSample')=1 LIMIT 1",
      )
      .get(user(r).id) as any;
    if (existing) {
      const found = store.load(existing.id);
      if (found?.demoSample) return present(found);
    }
    const names = ["Ali", "Sara", "Reza", "Nima"];
    const members = names.map((name, i) => ({
      id: id(),
      name: i === 0 ? user(r).name : name,
      userId: i === 0 ? user(r).id : null,
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
      demoSample: true,
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
    for (const e of h.expenses) {
      e.createdByUserId = user(r).id;
      e.revision = 1;
    }
    return persist(r, h, "hangout.created", h.id, { sample: true });
  });
  app.addHook("onClose", () => store.db.close());
  registerV12(app, store, get, fail);
  return app;
}
