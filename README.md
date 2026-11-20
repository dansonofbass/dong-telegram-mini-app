# DONG v1.2

**Good times. Fair splits.** A local-first Telegram Mini App for itemized expenses between friends, built from scratch with React, TypeScript, Vite, Tailwind, Fastify and SQLite. Node 22.13+ is required; verified on Node 24.18, Windows, without Docker.

## Run

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. One process serves the API and Vite. Forward-only migrations preserve existing records. A fresh local browser asks for a display name and receives its own opaque, backend-managed guest session. A second browser or private window creates an independent identity. Refreshing preserves the identity. Sample data is created only when you explicitly select **Explore a sample dinner** in Settings; it lives in a separate sample hangout.

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm start
```

Production startup requires Telegram configuration and disables guest authentication and sample creation. `npm start` serves `dist` and the API in one process. In PowerShell with script restrictions, use `npm.cmd` instead of `npm`; no execution-policy changes are necessary. Browser tests start or reuse an isolated server on port 3001 with data under ignored `artifacts/v12-e2e`, leaving the primary database untouched.

## Features

- Create hangouts in AMD, USD, EUR or USDT (accounting unit only).
- Verified Telegram identity with an internal user ID, permanent display-name confirmation, first/last name metadata, username and optional avatar. No phone number, OTP or password required.
- Individual and shared items, quantities, custom integer weights, fixed or percentage tax, fees, tip and discounts, with proportional or equal adjustment allocation.
- Multiple payers, deterministic rounding, reconciled balances and simplified debt transfers.
- Immutable expense creator separate from payer. Members edit their own expenses. Owner corrections require explicit administrative actions and leave audit records. Expense revisions reject stale edits with HTTP 409; deletion is blocked once confirmed payments could be affected.
- Secure 30-day invitations, revocation, onboarding-safe browser URLs and Telegram deep links. Joining is idempotent; private expenses require authenticated membership.
- A persistent, paginated Activity timeline with backend-generated actors, resources and timestamps. Financial mutations and their events are transactional; raw receiving details and tokens never enter event metadata.
- Mark partial external settlements and let only the creditor confirm receipt. Pending records do not reduce debt.
- User-owned bank cards, account numbers/IBANs, wallets, cash and other receiving methods, with preferred selection, masked previews and intentional authorized detail/copy actions. Only the owner and relevant debtors can read private values.
- English/Lato and Persian/Noto Sans Arabic, RTL, local bundled fonts, light/dark themes and responsive debt flow.
- Telegram HMAC validation and expiry, membership authorization, input limits, rate limiting and SQLite transactions.
- Independent browser guests, lightweight synchronization every 2.5 seconds while visible, and functional sample data isolated from real hangouts and production.
- Premium selectable debt lanes with directional SVG markers, stable straight/Bézier paths, a compact crowded-list fallback and reduced-motion support.

## Layout

`src/components.tsx` contains shared visual components, `src/context.ts` the client context, `src/features.tsx` the onboarding, activity, receiving and debt experiences, and `src/App.tsx` the shell and expense pages. Dictionaries remain in `src/i18n.ts`. `shared/engine.ts` is the integer calculation engine and shared model. `server/` contains Fastify routes, authentication and versioned SQLite migrations. `tests/` contains financial/API/migration tests and Playwright journeys. The immutable primary design reference remains at `design-reference/dong-reference.webp`.

The database includes normalized users, hangouts, members, invitations, expenses, expense items, allocations, adjustments, settlements and receiving preferences, plus a transactional aggregate snapshot for consistent reads. Money is integer minor units (AMD: 0 decimals; USD/EUR/USDT: 2). Fractional distribution uses BigInt and a stable largest-remainder rule.

Percentage inputs are integer basis points: `125` means 1.25%. Discounts are computed from original item subtotal before fixed discounts are applied. Tax, service and tip percentages use the discounted subtotal, then fixed fees are added. Percentage conversion rounds half up; member allocations reconcile with the stable largest-remainder rule. The specified 20,000 AMD subtotal, 10% discount, 1,000 fixed tax and 5% service produces exactly **19,900 AMD**.

Existing v1 expenses did not record their creators. The migration preserves them and assigns the hangout owner as their legacy custodian; it does not fabricate historical activity. New creators are taken only from authenticated identity and never change. Original demo records remain stored but are not automatically assigned to fresh guests. Legacy receiving values remain preserved and are migrated into owner-managed methods.

See [local setup](docs/LOCAL_SETUP.md), [Telegram setup](docs/TELEGRAM_SETUP.md), [deployment](docs/DEPLOYMENT.md) and [test report](docs/TEST_REPORT.md).

No payment processing, external transfer verification, cryptocurrency transfers or exchange-rate conversion is provided. Corrections preserve confirmed settlements; balances recalculate and can reverse when a correction changes who owes whom.
