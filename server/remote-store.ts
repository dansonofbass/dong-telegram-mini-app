import { randomUUID } from "node:crypto";
import { expenseShares, type Hangout } from "../shared/engine";
import type { LogInput } from "./db";
import type { RemoteDatabase } from "./storage";
export function remoteStore(
  db: RemoteDatabase,
  transaction: RemoteDatabase["transaction"],
) {
  const load = async (id: string) => {
    const row = (await db
      .prepare("SELECT document FROM hangouts WHERE id=?")
      .get(id)) as unknown as
      | {
          document: string;
        }
      | undefined;
    return row ? (JSON.parse(row.document) as Hangout) : undefined;
  };
  async function log(hangoutId: string, event: LogInput) {
    await db
      .prepare(
        "INSERT INTO activity_log(id,hangout_id,actor_user_id,event_type,resource_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        hangoutId,
        event.actorUserId,
        event.type,
        event.resourceId || null,
        JSON.stringify(event.metadata || {}),
        new Date().toISOString(),
      );
  }
  async function save(
    h: Hangout,
    events: LogInput[] = [],
    submission?: {
      userId: string;
      key: string;
      response: string;
    },
  ) {
    return await transaction(async () => {
      const current = (await db
        .prepare("SELECT version FROM hangouts WHERE id=?")
        .get(h.id)) as unknown as
        | {
            version: number;
          }
        | undefined;
      if (current && current.version !== (h.version || 0))
        throw Object.assign(Error("conflict"), { statusCode: 409 });
      h.version = (h.version || 0) + 1;
      await db
        .prepare(
          "INSERT INTO hangouts(id,owner_id,title,currency,document) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,document=excluded.document,updated_at=CURRENT_TIMESTAMP",
        )
        .run(h.id, h.ownerId, h.title, h.currency, JSON.stringify(h));
      await db
        .prepare("UPDATE hangouts SET version=? WHERE id=?")
        .run(h.version, h.id);
      for (const m of h.members)
        await db
          .prepare(
            "INSERT INTO members(id,hangout_id,user_id,name) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
          )
          .run(m.id, h.id, m.userId, m.name);
      await db.prepare("DELETE FROM settlements WHERE hangout_id=?").run(h.id);
      await db.prepare("DELETE FROM expenses WHERE hangout_id=?").run(h.id);
      for (const e of h.expenses) {
        await db
          .prepare(
            "INSERT INTO expenses(id,hangout_id,payer_id,title,created_by_user_id) VALUES(?,?,?,?,?)",
          )
          .run(e.id, h.id, e.payerId, e.title, e.createdByUserId || h.ownerId);
        for (const item of e.items) {
          const id = item.id || randomUUID();
          await db
            .prepare("INSERT INTO expense_items VALUES(?,?,?,?,?)")
            .run(id, e.id, item.title, item.quantity, item.unitPrice);
          for (const a of item.allocations)
            await db
              .prepare("INSERT INTO item_allocations VALUES(?,?,?)")
              .run(id, a.memberId, a.weight);
        }
        for (const kind of ["tax", "tip", "service", "discount"] as const)
          await db
            .prepare(
              "INSERT INTO expense_adjustments(expense_id,kind,amount,mode,input_value) VALUES(?,?,?,?,?)",
            )
            .run(
              e.id,
              kind,
              expenseShares(e).adjustments[kind],
              e.adjustments?.[kind]?.mode || "fixed",
              e.adjustments?.[kind]?.value ?? e[kind],
            );
      }
      for (const s of h.settlements)
        await db
          .prepare(
            "INSERT INTO settlements(id,hangout_id,from_id,to_id,amount,status,method,receiving_method_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .run(
            s.id,
            h.id,
            s.fromId,
            s.toId,
            s.amount,
            s.status,
            s.method,
            s.receivingMethodId || null,
            s.createdAt,
          );
      const keep = h.members.map((m) => m.id);
      const old = (await db
        .prepare("SELECT id FROM members WHERE hangout_id=?")
        .all(h.id)) as unknown as {
        id: string;
      }[];
      for (const m of old)
        if (!keep.includes(m.id))
          await db.prepare("DELETE FROM members WHERE id=?").run(m.id);
      for (const [id, p] of Object.entries(h.preferences))
        await db
          .prepare(
            "INSERT INTO settlement_preferences VALUES(?,?,?) ON CONFLICT(member_id) DO UPDATE SET method=excluded.method,details=excluded.details",
          )
          .run(id, p.method, p.details);
      await db
        .prepare(
          "UPDATE invitations SET revoked=1 WHERE hangout_id=? AND token<>?",
        )
        .run(h.id, h.inviteToken);
      await db
        .prepare(
          "INSERT OR IGNORE INTO invitations(token,hangout_id,expires_at) VALUES(?,?,?)",
        )
        .run(
          h.inviteToken,
          h.id,
          new Date(Date.now() + 30 * 86400000).toISOString(),
        );
      for (const event of events) await log(h.id, event);
      if (submission)
        await db
          .prepare(
            "INSERT INTO submissions(user_id,key,response) VALUES(?,?,?)",
          )
          .run(submission.userId, submission.key, submission.response);
    });
  }
  return { db, load, save, log, transaction };
}
