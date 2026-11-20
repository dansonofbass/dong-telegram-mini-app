# Local setup

Use Node 22.13 or newer, npm and a browser. No database installation is needed: the lightweight built-in `node:sqlite` driver is used. Its experimental warning on some Node versions is expected.

1. Run `npm install` (on restricted PowerShell use `npm.cmd install`).
2. Run `npm run dev`, then open http://localhost:3000.
3. Enter your display name. A unique opaque guest session is stored in an HttpOnly, SameSite cookie; only its SHA-256 hash is stored in SQLite. No identity token is stored in browser localStorage. A different browser/profile/private context receives a different identity, even with the same name.
4. Create a hangout, copy its `/invite/TOKEN` link and open it in a different browser. The URL survives onboarding and refresh; confirming the new guest's name joins the original hangout and opens its existing expenses. Repeat visits do not create duplicate memberships.
5. Select **Explore a sample dinner** in Settings only when you want sample data. It creates a separate four-person sample. Additional simulated participants are allowed only inside explicit sample hangouts, not real hangouts. Actual friends join using invitations.
6. Manage **My Receiving Methods** from Settings or Profile. To test payer/creditor permissions, use distinct browser identities joined to the same hangout; the old shared `Demo ali` headers and predefined identity selector are no longer accepted.

The persistent database defaults to `data/dong.sqlite`. Set `DATA_DIR` to another directory before startup. Configuration variables are documented in `.env.example`; set them in the environment or copy the example to the ignored `.env` file, which startup loads automatically. `HOST` defaults to loopback, `PORT` to 3000. Demo auth is a development-only identity selector, not a security boundary suitable for network exposure. Keep development on loopback.

Unit/API tests use temporary or in-memory databases, including a fixture with the original v1 schema. Browser tests use installed Microsoft Edge (`channel: msedge`). `npm run test:e2e` starts or reuses a separate port-3001 server with an isolated SQLite file in `artifacts/v12-e2e`. Screenshots go to ignored `artifacts/`; reports go to ignored `test-results/`. API changes require restarting the development process; Vite updates client changes automatically.

Migrations 1–3 run once, preserving earlier records and confirmed payments. No database reset command is used. Hangout changes refresh through visible-page polling every 2.5 seconds and on window focus. Expense edits carry their original revision; HTTP 409 means another edit won the race. Reload the record before retrying. The owner must select **Administrative correction/removal** to change somebody else's expense; the action is always logged.

The Vite config uses the runner loader because Windows sandboxed child-process directory enumeration can block esbuild's config bundler. If a restricted environment blocks dependency optimization, authorize the ordinary local dev command through the environment's approval system; do not change Windows security settings.
