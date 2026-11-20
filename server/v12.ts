import { z } from "zod";
import { randomUUID } from "node:crypto";
import { calculate, type Hangout } from "../shared/engine";
import type { Store } from "./storage";
import type { FastifyInstance } from "fastify";
import { normalizeReceivingValue } from "../shared/receiving";
import { accountBalances } from "../shared/balances";
export function registerV12(
  app: FastifyInstance,
  store: Store,
  get: (r: any, owner?: boolean) => Promise<Hangout>,
  fail: (c: string, s?: number) => never,
) {
  const uid = (r: any) => r.user.id as string;
  const mask = (v: string) =>
    v.length > 4 ? "•••• " + v.slice(-4) : v ? "••••" : "";
  const method = (m: any, full = false) => ({
    id: m.id,
    userId: m.user_id,
    kind: m.kind,
    label: m.label,
    maskedValue: mask(m.value),
    recipientName: m.recipient_name,
    bankName: m.bank_name,
    network: m.network,
    preferred: !!m.preferred,
    ...(full ? { value: m.value } : {}),
  });
  const schema = z
    .object({
      kind: z.enum(["card", "bank", "wallet", "cash", "other"]),
      label: z.string().trim().max(60).default(""),
      value: z.string().trim().max(150).default(""),
      recipientName: z.string().trim().max(100).default(""),
      bankName: z.string().trim().max(100).default(""),
      network: z.string().trim().max(40).default(""),
      preferred: z.boolean().default(false),
    })
    .transform((b) => ({
      ...b,
      value: normalizeReceivingValue(b.kind, b.value),
    }))
    .superRefine((b, c) => {
      if (b.kind !== "cash" && !b.value)
        c.addIssue({ code: "custom", message: "receivingRequired" });
      else if (b.kind === "card" && !/^\d{12,19}$/.test(b.value))
        c.addIssue({ code: "custom", message: "invalidCard" });
      else if (b.kind === "bank" && !/^[A-Z0-9]{5,50}$/.test(b.value))
        c.addIssue({ code: "custom", message: "invalidBank" });
    });
  app.get("/api/balances", async (r) => {
    const rows = (await store.db
      .prepare(
        "SELECT h.document FROM hangouts h JOIN members m ON m.hangout_id=h.id WHERE m.user_id=?",
      )
      .all(uid(r))) as {
      document: string;
    }[];
    return accountBalances(
      rows.map((row) => JSON.parse(row.document)),
      uid(r),
    );
  });
  async function logMethods(r: any, resourceId: string) {
    const rows = (await store.db
      .prepare("SELECT hangout_id FROM members WHERE user_id=?")
      .all(uid(r))) as any[];
    for (const row of rows) {
      const h = (await store.load(row.hangout_id))!;
      h.version = (h.version || 0) + 1;
      await store.db
        .prepare(
          "UPDATE hangouts SET version=?,document=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .run(h.version, JSON.stringify(h), h.id);
      await store.log(row.hangout_id, {
        actorUserId: uid(r),
        type: "receiving.updated",
        resourceId,
      });
    }
  }
  app.get("/api/receiving-methods", async (r) =>
    (
      (await store.db
        .prepare(
          "SELECT * FROM receiving_methods WHERE user_id=? ORDER BY preferred DESC,created_at,id",
        )
        .all(uid(r))) as any[]
    ).map((m) => method(m)),
  );
  app.get("/api/receiving-methods/:methodId", async (r) => {
    const m = (await store.db
      .prepare("SELECT * FROM receiving_methods WHERE id=?")
      .get((r.params as any).methodId)) as any;
    if (!m || m.user_id !== uid(r)) fail("forbidden", 403);
    return method(m, true);
  });
  const write = async (r: any, edit: boolean) => {
    const mid = edit ? r.params.methodId : randomUUID();
    if (edit) {
      const old = (await store.db
        .prepare("SELECT * FROM receiving_methods WHERE id=?")
        .get(mid)) as any;
      if (!old || old.user_id !== uid(r)) fail("forbidden", 403);
    }
    const b = schema.parse(r.body);
    await await store.transaction(async () => {
      if (b.preferred)
        await store.db
          .prepare("UPDATE receiving_methods SET preferred=0 WHERE user_id=?")
          .run(uid(r));
      if (edit)
        await store.db
          .prepare(
            "UPDATE receiving_methods SET kind=?,label=?,value=?,recipient_name=?,bank_name=?,network=?,preferred=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .run(
            b.kind,
            b.label,
            b.kind === "cash" ? "" : b.value,
            b.recipientName,
            b.bankName,
            b.network,
            Number(b.preferred),
            mid,
          );
      else
        await store.db
          .prepare(
            "INSERT INTO receiving_methods(id,user_id,kind,label,value,recipient_name,bank_name,network,preferred) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .run(
            mid,
            uid(r),
            b.kind,
            b.label,
            b.kind === "cash" ? "" : b.value,
            b.recipientName,
            b.bankName,
            b.network,
            Number(b.preferred),
          );
      await logMethods(r, mid);
    });
    return method(
      await store.db
        .prepare("SELECT * FROM receiving_methods WHERE id=?")
        .get(mid),
    );
  };
  app.post("/api/receiving-methods", async (r) => await write(r, false));
  app.put(
    "/api/receiving-methods/:methodId",
    async (r) => await write(r, true),
  );
  app.delete("/api/receiving-methods/:methodId", async (r) => {
    const mid = (r.params as any).methodId;
    const m = (await store.db
      .prepare("SELECT * FROM receiving_methods WHERE id=?")
      .get(mid)) as any;
    if (!m || m.user_id !== uid(r)) fail("forbidden", 403);
    await await store.transaction(async () => {
      await store.db
        .prepare("DELETE FROM receiving_methods WHERE id=?")
        .run(mid);
      await logMethods(r, mid);
    });
    return { ok: true };
  });
  async function creditor(r: any) {
    const h = await get(r);
    const memberId = r.params.memberId;
    const me = h.members.find((m) => m.userId === uid(r));
    const target = h.members.find((m) => m.id === memberId);
    if (!me || !target?.userId) fail("forbidden", 403);
    if (
      me!.id !== memberId &&
      !calculate(h).transfers.some(
        (t) => t.fromId === me!.id && t.toId === memberId,
      )
    )
      fail("forbidden", 403);
    return target!.userId!;
  }
  app.get("/api/hangouts/:id/receiving/:memberId", async (r) => {
    const userId = await creditor(r);
    return (
      (await store.db
        .prepare(
          "SELECT * FROM receiving_methods WHERE user_id=? ORDER BY preferred DESC,created_at,id",
        )
        .all(userId)) as any[]
    ).map((m) => method(m));
  });
  app.get("/api/hangouts/:id/receiving/:memberId/:methodId", async (r) => {
    const userId = await creditor(r);
    const m = (await store.db
      .prepare("SELECT * FROM receiving_methods WHERE id=? AND user_id=?")
      .get((r.params as any).methodId, userId)) as any;
    if (!m) fail("forbidden", 403);
    return method(m, true);
  });
  app.get("/api/hangouts/:id/activity", async (r) => {
    const h = await get(r);
    const q = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        before: z.coerce.number().int().positive().optional(),
      })
      .parse(r.query);
    const rows = (await store.db
      .prepare(
        "SELECT a.*,u.name AS actor_name FROM activity_log a JOIN users u ON u.id=a.actor_user_id WHERE a.hangout_id=? AND a.sequence<? ORDER BY a.sequence DESC LIMIT ?",
      )
      .all(h.id, q.before || Number.MAX_SAFE_INTEGER, q.limit + 1)) as any[];
    const events = rows.slice(0, q.limit).map((a) => ({
      id: a.id,
      sequence: a.sequence,
      hangoutId: a.hangout_id,
      actorUserId: a.actor_user_id,
      actorName: a.actor_name,
      type: a.event_type,
      resourceId: a.resource_id,
      metadata: JSON.parse(a.metadata),
      createdAt: a.created_at,
    }));
    return {
      events,
      nextCursor: rows.length > q.limit ? events.at(-1)?.sequence : null,
    };
  });
  app.patch("/api/hangouts/:id", async (r) => {
    const h = await get(r, true);
    const b = z
      .object({
        title: z.string().trim().min(1).max(100),
        description: z.string().max(500),
        expectedVersion: z.number().int(),
      })
      .parse(r.body);
    if (b.expectedVersion !== (h.version || 0)) fail("conflict", 409);
    h.title = b.title;
    h.description = b.description;
    await store.save(h, [
      { actorUserId: uid(r), type: "hangout.updated", resourceId: h.id },
    ]);
    return { ...h, preferences: {} };
  });
}
