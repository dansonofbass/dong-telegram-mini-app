import type { RemoteDatabase } from "./storage";
export async function migrateEmptyDatabase(db: RemoteDatabase, sql: string) {
  await db.transaction(async () => {
    const tables = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all();
    if (tables.length) {
      const version = await db
        .prepare("SELECT max(version) AS version FROM migrations")
        .get();
      if (version?.version === 3) return;
      throw Error(
        "Existing unsupported schema: migration refused; use a new empty database",
      );
    }
    await db.exec(sql);
  });
}
