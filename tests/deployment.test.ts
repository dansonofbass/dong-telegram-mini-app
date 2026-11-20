import { migrateEmptyDatabase } from "../server/migrations";
import { createNodeHandler } from "../server/node-handler";
import { createServer } from "node:http";
import { it, expect } from "vitest";
import { readFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { remoteDatabase } from "../server/storage";
import { remoteStore } from "../server/remote-store";
import { createApp } from "../server/app";
import { createHmac } from "node:crypto";
function signed(id: number) {
  const p = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: "User " + id }),
  });
  const key = createHmac("sha256", "WebAppData").update("test-token").digest();
  p.set(
    "hash",
    createHmac("sha256", key)
      .update(
        [...p]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => k + "=" + v)
          .join("\n"),
      )
      .digest("hex"),
  );
  return "tma " + p;
}
it("async libSQL storage preserves identities across app instances, enforces guests and rolls back atomic writes", async () => {
  mkdirSync("artifacts", { recursive: true });
  const dir = mkdtempSync(join(process.cwd(), "artifacts", "dong-libsql-"));
  const url = "file:" + join(dir, "test.sqlite").replaceAll("\\", "/");
  const db = remoteDatabase(url);
  const sql = readFileSync(
    new URL("../server/schema.sql", import.meta.url),
    "utf8",
  );
  await migrateEmptyDatabase(db, sql);
  await migrateEmptyDatabase(db, sql);
  const store = remoteStore(db, db.transaction);
  let app = await createApp({
    storage: store,
    production: true,
    botToken: "test-token",
  });
  try {
    const users = [];
    for (const id of [101, 102, 103]) {
      const response = await app.inject({
        url: "/api/me",
        headers: { authorization: signed(id) },
      });
      expect(response.statusCode).toBe(200);
      users.push(response.json().id);
    }
    expect(new Set(users).size).toBe(3);
    const handler = createNodeHandler(async () => app);
    const http = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    try {
      const port = (http.address() as { port: number }).port;
      const base = "http://127.0.0.1:" + port;
      expect(await (await fetch(base + "/api/health")).json()).toEqual({
        ok: true,
      });
      expect((await fetch(base + "/api/me")).status).toBe(401);
      expect(
        (await fetch(base + "/api/nonexistent")).headers.get("content-type"),
      ).toContain("application/json");
    } finally {
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve())),
      );
    }

    const headers = { authorization: signed(101) };
    await app.inject({
      method: "PUT",
      url: "/api/me",
      headers,
      payload: { name: "Owner" },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/hangouts",
      headers,
      payload: { title: "Async ledger", date: "2026-11-21" },
    });
    expect(created.statusCode).toBe(200);
    const h = created.json();
    const payload = {
      title: "Meal",
      payerId: h.members[0].id,
      currency: h.currency,
      items: [
        {
          title: "Food",
          quantity: 1,
          unitPrice: 1000,
          allocations: [{ memberId: h.members[0].id, weight: 1 }],
        },
      ],
      tax: 0,
      tip: 0,
      service: 0,
      discount: 0,
    };
    const expense = await app.inject({
      method: "POST",
      url: "/api/hangouts/" + h.id + "/expenses",
      headers: { ...headers, "idempotency-key": "one" },
      payload,
    });
    expect(expense.statusCode).toBe(200);
    const repeated = await app.inject({
      method: "POST",
      url: "/api/hangouts/" + h.id + "/expenses",
      headers: { ...headers, "idempotency-key": "one" },
      payload,
    });
    expect(repeated.json().expenses).toHaveLength(1);
    const activity = await app.inject({
      url: "/api/hangouts/" + h.id + "/activity",
      headers,
    });
    expect(
      activity.json().events.filter((e: any) => e.type === "expense.created"),
    ).toHaveLength(1);
    for (const id of [102,103]) await app.inject({method:'PUT',url:'/api/me',headers:{authorization:signed(id)},payload:{name:'Peer '+id}});
    const joins=await Promise.all([102,103].map(id=>app.inject({method:'POST',url:'/api/invites/'+h.inviteToken+'/join',headers:{authorization:signed(id)},payload:{}})));
    expect(joins.map(r=>r.statusCode)).toEqual([200,200]);
    expect((await store.load(h.id))!.members).toHaveLength(3);
    expect((await app.inject({method:'POST',url:'/api/invites/'+h.inviteToken+'/join',headers:{authorization:signed(102)},payload:{}})).statusCode).toBe(200);
    expect((await store.load(h.id))!.members).toHaveLength(3);
    const first = (await store.load(h.id))!;
    const stale = structuredClone(first);
    await store.save(first);
    await expect(store.save(stale)).rejects.toMatchObject({ statusCode: 409 });
    const before = (await store.load(h.id))!;
    await expect(
      store.save(before, [{ actorUserId: "nonexistent", type: "invalid" }]),
    ).rejects.toThrow();
    expect((await store.load(h.id))!.version).toBe(first.version);
    expect(
      Number((await db.prepare("PRAGMA foreign_keys").get())?.foreign_keys),
    ).toBe(1);
    expect((await app.inject({ url: "/api/me" })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/guest",
          payload: { name: "Demo" },
        })
      ).statusCode,
    ).toBe(403);
    await expect(
      db.transaction(async () => {
        await db
          .prepare("INSERT INTO users(id,name) VALUES(?,?)")
          .run("rollback", "Rollback");
        throw Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(
      await db.prepare("SELECT id FROM users WHERE id=?").get("rollback"),
    ).toBeUndefined();
    await app.close();
    const reopened = remoteDatabase(url);
    app = await createApp({
      storage: remoteStore(reopened, reopened.transaction),
      production: true,
      botToken: "test-token",
    });
    expect(
      (
        await app.inject({
          url: "/api/me",
          headers: { authorization: signed(101) },
        })
      ).json().id,
    ).toBe(users[0]);
  } finally {
    await app.close();
    if (process.platform !== "win32")
      rmSync(dir, { recursive: true, force: true });
  }
});

it('rolls back failed bootstrap migrations and retries a failed cold start safely', async () => {
 const db=remoteDatabase('file::memory:');
 try {
  await expect(migrateEmptyDatabase(db,'CREATE TABLE partial(id TEXT); INSERT INTO missing VALUES(1);')).rejects.toThrow();
  expect(await db.prepare("SELECT name FROM sqlite_master WHERE name='partial'").get()).toBeUndefined();
  const sql=readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8');
  await migrateEmptyDatabase(db,sql);
  expect((await db.prepare('SELECT count(*) AS count FROM users').get())?.count).toBe(0);
 } finally {db.close();}
 let attempts=0;
 const app=await createApp({database:':memory:',production:true,botToken:'test-token'});
 const handler=createNodeHandler(async()=>{if(++attempts===1)throw Error('private connection detail');return app;});
 const http=createServer((req,res)=>{void handler(req,res);});
 await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve));
 try {
  const base='http://127.0.0.1:'+(http.address() as {port:number}).port;
  const failed=await fetch(base+'/api/health');expect(failed.status).toBe(503);expect(await failed.text()).not.toContain('private');
  expect((await fetch(base+'/api/health')).status).toBe(200);
 } finally {await new Promise<void>(resolve=>http.close(()=>resolve()));await app.close();}
});
