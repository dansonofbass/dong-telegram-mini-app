# DONG

**Good times. Fair splits.** A local-first Telegram Mini App for itemized expenses between friends, built from scratch with React, TypeScript, Vite, Tailwind, Fastify and SQLite. Node 22.13+ is required; verified on Node 24.18, Windows, without Docker.

## Run

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. One process serves the API and Vite. Database migrations run automatically without resetting existing records. Local demo mode creates a working four-person dinner with multiple payers. Settings lets you switch demo identities to test debtor and creditor permissions.

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm start
```

Production startup requires Telegram configuration and disables demo identity. `npm start` serves `dist` and the API in one process. In PowerShell with script restrictions, use `npm.cmd` instead of `npm`; no execution-policy changes are necessary.

## Features

- Create hangouts in AMD, USD, EUR or USDT (accounting unit only).
- Individual and shared items, quantities, custom integer weights, proportional tax, fees, tip and discounts.
- Multiple payers, deterministic rounding, reconciled balances and simplified debt transfers.
- Expense details, editing/deletion with automatic recalculation, members, secure invite tokens and link rotation.
- Mark partial external settlements and let only the creditor confirm receipt. Pending records do not reduce debt.
- Optional receiving details, clipboard copy and Telegram sharing.
- English/Lato and Persian/Noto Sans Arabic, RTL, local bundled fonts, light/dark themes and responsive debt flow.
- Telegram HMAC validation and expiry, membership authorization, input limits, rate limiting and SQLite transactions.
- Functional browser demo with persistent SQLite data, isolated from production.

## Layout

`src/` contains the client, reusable visual components, pages, dictionaries and styles. `shared/engine.ts` is the integer calculation engine and shared model. `server/` contains Fastify routes, authentication and the versioned SQLite migration. `tests/` contains financial/API tests and essential Playwright journeys. The immutable primary design reference remains at `design-reference/dong-reference.webp`.

The database includes normalized users, hangouts, members, invitations, expenses, expense items, allocations, adjustments, settlements and receiving preferences, plus a transactional aggregate snapshot for consistent reads. Money is integer minor units (AMD: 0 decimals; USD/EUR/USDT: 2). Fractional distribution uses BigInt and a stable largest-remainder rule.

See [local setup](docs/LOCAL_SETUP.md), [Telegram setup](docs/TELEGRAM_SETUP.md), [deployment](docs/DEPLOYMENT.md) and [test report](docs/TEST_REPORT.md).

No payment processing, external transfer verification, cryptocurrency transfers or exchange-rate conversion is provided. Corrections preserve confirmed settlements; balances recalculate and can reverse when a correction changes who owes whom.
