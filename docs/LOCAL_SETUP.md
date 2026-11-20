# Local setup

Use Node 22.13 or newer, npm and a browser. No database installation is needed: the lightweight built-in `node:sqlite` driver is used. Its experimental warning on some Node versions is expected.

1. Run `npm install` (on restricted PowerShell use `npm.cmd install`).
2. Run `npm run dev`, then open http://localhost:3000.
3. The first Ali session creates a sample dinner. Change identities under Settings to experience the other members' permissions. Add local participants under a hangout's Members screen.

The persistent database defaults to `data/dong.sqlite`. Set `DATA_DIR` to another directory before startup. Configuration variables are documented in `.env.example`; set them in the environment or copy the example to the ignored `.env` file, which startup loads automatically. `HOST` defaults to loopback, `PORT` to 3000. Demo auth is a development-only identity selector, not a security boundary suitable for network exposure. Keep development on loopback.

Tests use temporary or in-memory databases. Browser tests currently use installed Microsoft Edge (`channel: msedge`); change the channel in `playwright.config.ts` for another installed supported browser. Start the local server before running `npm run test:e2e`. Screenshots go to ignored `artifacts/`; reports go to ignored `test-results/`.

The Vite config uses the runner loader because Windows sandboxed child-process directory enumeration can block esbuild's config bundler. If a restricted environment blocks dependency optimization, authorize the ordinary local dev command through the environment's approval system; do not change Windows security settings.
