# Turso setup

Use a Turso **libSQL** database, compatible with @libsql/client. The newer Turso engine is a different product/driver choice. See the [official TypeScript reference](https://docs.turso.tech/sdk/ts/reference).

1. Create a Turso account on the Free plan. Install the CLI using the official instructions for your platform, or use the dashboard.
2. Authenticate with `turso auth login`.
3. Create the database: `turso db create dong-production` (omit --tursodb to use libSQL).
4. Get its URL with `turso db show dong-production --url`.
5. Generate credentials with `turso db tokens create dong-production`. Enter them directly into your local secret environment and Vercel Production settings. Never commit or paste them into documentation.
6. Confirm the target is the new empty remote database. In a private PowerShell session configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN, then run:

```powershell
$env:CONFIRM_DATABASE_MIGRATION='yes'
npm.cmd run db:migrate
Remove-Item Env:CONFIRM_DATABASE_MIGRATION
```

The migration uses an interactive write transaction. Empty databases receive schema versions 1�3, constraints and indexes with no user data. Repeating the command on version 3 makes no changes. Existing unsupported schemas are refused. This command is a bootstrap for a new production database; it does not upgrade arbitrary remote historical databases. Future schema changes require a new reviewed versioned migration.

Runtime requires schema version 3 and refuses local SQLite fallback on Vercel. Remote writes use transaction-scoped connections, optimistic hangout versions, and atomic activity/submission writes. Local development continues to use node:sqlite and existing local migrations. The existing database has not been cleared, imported, reset or deleted.

Live Turso networking, credentials, quotas and remote concurrency must still be tested against an actual disposable database before production. Local libSQL tests verify adapter behavior but do not prove network integration.
