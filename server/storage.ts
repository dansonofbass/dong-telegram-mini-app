import { AsyncLocalStorage } from "node:async_hooks";
import { createClient, type InValue, type InStatement, type Transaction } from "@libsql/client";
import { openDatabase } from "./db";
import { remoteStore } from "./remote-store";
export function remoteDatabase(url: string, authToken?: string) {
  const client = createClient({ url, authToken, intMode: "number" });
  // Transaction writes are batched to avoid a network round trip per ledger item.
  // Reads flush pending writes so read-your-writes behavior is preserved.
  const scope = new AsyncLocalStorage<{tx: Transaction; pending: InStatement[]}>();
  const flush = async (context = scope.getStore()) => {
    if (context?.pending.length) await context.tx.batch(context.pending.splice(0));
  };
  const execute = async (sql: string, args: InValue[] = []) => {
    await flush();
    return (scope.getStore()?.tx || client).execute({sql,args});
  };
  const db = {
    prepare(sql: string) {
      return {
        async get(...args: InValue[]) {
          return (await execute(sql, args)).rows[0];
        },
        async all(...args: InValue[]) {
          return (await execute(sql, args)).rows;
        },
        async run(...args: InValue[]) {
          const context = scope.getStore();
          if (context) { context.pending.push({sql,args}); return; }
          await execute(sql,args);
        },
      };
    },
    async exec(sql: string) {
      await flush();
      await (scope.getStore()?.tx || client).executeMultiple(sql);
    },
    close() {
      client.close();
    },
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      if (scope.getStore()) return work();
      const tx = await client.transaction("write");
      try {
        const context = {tx, pending: [] as InStatement[]};
        const result = await scope.run(context, work);
        await flush(context);
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        tx.close();
      }
    },
  };
  return db;
}
export type RemoteDatabase = ReturnType<typeof remoteDatabase>;
export async function openStorage(path: string) {
  const remote = process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL && !remote)
    throw Error("TURSO_DATABASE_URL is required on Vercel");
  if (remote) {
    if (!/^(libsql|https):\/\//.test(remote) || !process.env.TURSO_AUTH_TOKEN)
      throw Error("Remote Turso URL and token required");
    if (
      process.env.VERCEL_ENV === "preview" &&
      process.env.ALLOW_PREVIEW_DATABASE !== "true"
    )
      throw Error(
        "Preview database access requires explicit opt-in and a separate database",
      );
    const db = remoteDatabase(remote, process.env.TURSO_AUTH_TOKEN);
    const version = await db
      .prepare("SELECT max(version) AS version FROM migrations")
      .get();
    if (version?.version !== 3) {
      db.close();
      throw Error("Run database migrations before starting DONG");
    }
    return remoteStore(db, db.transaction);
  }
  const local = openDatabase(path);
  return {
    ...local,
    transaction: async <T>(work: () => Promise<T>): Promise<T> => {
      local.db.exec("BEGIN IMMEDIATE");
      try {
        const result = await work();
        local.db.exec("COMMIT");
        return result;
      } catch (error) {
        local.db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
export type Store = Awaited<ReturnType<typeof openStorage>>;
