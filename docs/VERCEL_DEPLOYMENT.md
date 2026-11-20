# Vercel deployment

Status: prepared locally; public Vercel and remote Turso verification are still required.

1. Create a private repository in GitHub using New repository; leave initialization unchecked. From this repository add its HTTPS URL with `git remote add origin <URL>` if no origin exists. Inspect `git remote -v` first. When authorized, publish with `git push -u origin release/dong-vercel`. No push was performed by this preparation.
2. Create an empty **libSQL** database using [Turso setup](TURSO_SETUP.md). Do not import the development database.
3. In Vercel choose Hobby, Add New Project, Import the GitHub repository. Set production branch to `release/dong-vercel`.
4. Root Directory: repository root. Framework Preset: **Vite**. Node.js: **24.x**. Install Command: `npm ci`. Build Command: `npm run build`. Output Directory: `dist`. Development Command: `npm run dev`.
5. Set Production environment variables listed below. Do not put production credentials in Preview or Development. Run the migration before first application traffic.
6. After authorization, deploy and set APP_BASE_URL to the assigned `https://<project>.vercel.app` origin, then redeploy. Configure Telegram using TELEGRAM_SETUP.md.
7. Verify `/` and a direct `/hangout/<authorized-id>/flow` navigation return the SPA, `/api/health` returns JSON, `/api/me` without initData returns 401, guest creation returns 403, and `/api/does-not-exist` never returns HTML. Check fingerprinted assets receive immutable cache headers.

Production variables:

- NODE_ENV=production
- DEMO_MODE=false
- TELEGRAM_BOT_TOKEN (secret)
- TELEGRAM_BOT_USERNAME (without @)
- TELEGRAM_APP_SHORT_NAME (BotFather Mini App short name)
- APP_BASE_URL (public HTTPS origin, no path)
- TURSO_DATABASE_URL (remote libsql:// URL)
- TURSO_AUTH_TOKEN (secret)

Preview database access is blocked unless ALLOW_PREVIEW_DATABASE=true. If enabling previews, provision a different database, token and testing bot. The application cannot determine whether two different credentials point at the same database: environment separation must be reviewed manually.

`api/index.ts` adapts the existing Fastify server to a Node Function without calling listen. Vercel rewrites API paths to that handler and other frontend paths to index.html; assets stay static. The native Fastify detector is designed around a backend entrypoint with listen; this repository retains the Vite preset and explicit Node handler to serve both from one project without that startup side effect. See [Vercel Fastify docs](https://vercel.com/docs/frameworks/backend/fastify) and [Node runtime](https://vercel.com/docs/functions/runtimes/node-js).

No build-time database writes occur. Startup checks the migration version but never migrates the production database. In-process rate limiting is best effort across stateless instances. There are no background workers, cron jobs or WebSockets. Free-tier quotas still apply.
