# Local setup

Use Node 22.13 or newer, npm and a browser. No database installation is needed: the lightweight built-in `node:sqlite` driver is used. Its experimental warning on some Node versions is expected.

1. Run `npm install` (on restricted PowerShell use `npm.cmd install`).
2. Run `npm run dev`, then open http://localhost:3000.
3. Enter your display name. A unique opaque guest session is stored in an HttpOnly, SameSite cookie; only its SHA-256 hash is stored in SQLite. No identity token is stored in browser localStorage. A different browser/profile/private context receives a different identity, even with the same name.
4. Create a hangout, copy its `/invite/TOKEN` link and open it in a different browser. The URL survives onboarding and refresh; confirming the new guest's name joins the original hangout and opens its existing expenses. Repeat visits do not create duplicate memberships.
5. Open **Try the interactive demo** from the initial screen, Home or Settings. The `/demo` guide needs no account and performs no backend mutations. Follow all nine stages: create a hangout, simulate invitations, add Ali's dinner, Sara's taxi and Reza's coffee, review live shares, inspect straight debt arrows, mark and confirm a partial payment, then inspect saved history and cross-hangout balances. Demo progress is stored separately in this browser and can be restarted. The old sample seed API remains development-only for regression fixtures; it is not the main user-facing demo.
6. Manage **My Receiving Methods** from Settings or Profile. To test payer/creditor permissions, use distinct browser identities joined to the same hangout; the old shared `Demo ali` headers and predefined identity selector are no longer accepted.

The receiving form accepts Persian/Arabic numerals such as `۶۲۱۹ ۸۶۱۹ ۱۲۳۴ ۵۶۷۸`, normalizes them to `6219861912345678` and shows masked previews. Card/account validation errors are displayed inline with specific guidance. Wallet addresses retain their original case.

Home's **Check the split** now opens `/balances`, which includes all saved shared hangouts. Debts between the same two authenticated identities are offset within each currency; matching display names alone never merge accounts. Original group records stay intact. Select a relationship to see the original sources and settlement links; on a group flow page, previous shared balances and the current-group balance are clearly separated.

The persistent database defaults to `data/dong.sqlite`. Set `DATA_DIR` to another directory before startup. Configuration variables are documented in `.env.example`; set them in the environment or copy the example to the ignored `.env` file, which startup loads automatically. `HOST` defaults to loopback, `PORT` to 3000. Demo auth is a development-only identity selector, not a security boundary suitable for network exposure. Keep development on loopback.

Unit/API tests use temporary or in-memory databases, including a fixture with the original v1 schema. Browser tests use installed Microsoft Edge (`channel: msedge`). `npm run test:e2e` starts or reuses a separate port-3001 server with an isolated SQLite file in `artifacts/v12-e2e`. Screenshots go to ignored `artifacts/`; reports go to ignored `test-results/`. API changes require restarting the development process; Vite updates client changes automatically.

Migrations 1–3 run once, preserving earlier records and confirmed payments. No database reset command is used. Hangout changes refresh through visible-page polling every 2.5 seconds and on window focus. Expense edits carry their original revision; HTTP 409 means another edit won the race. Reload the record before retrying. The owner must select **Administrative correction/removal** to change somebody else's expense; the action is always logged.

The Vite config uses the runner loader because Windows sandboxed child-process directory enumeration can block esbuild's config bundler. If a restricted environment blocks dependency optimization, authorize the ordinary local dev command through the environment's approval system; do not change Windows security settings.

The default bind host is `localhost` (IPv6 loopback on this Windows installation). This keeps `http://localhost:3000` attached to the updated application when a separate older process occupies the IPv4 wildcard port. `HOST` can override the loopback binding explicitly; this task did not stop or modify that unrelated IPv4 process.
