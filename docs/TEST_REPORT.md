# DONG test report

Verified locally on November 20, 2026, using Windows, Node 24.18.0, npm 11.16.0 and installed Microsoft Edge.

## Executed checks

| Check | Result |
| --- | --- |
| TypeScript `tsc --noEmit` | Passed |
| Production Vite build | Passed |
| Vitest financial and API suites | 17 tests passed across 2 files |
| Playwright essential browser journeys | 2 tests passed |
| npm dependency audit | Zero reported vulnerabilities |
| Development root and `/api/health` | HTTP 200, health `ok: true` |
| Production built page and SPA fallback | HTTP 200 |
| Production `Demo ali` authentication | Rejected with HTTP 401 |

## Covered behavior

Financial tests cover decimal parsing, zero-decimal AMD, individual unequal orders, shared-item rounding, custom weights, multiple payers, proportional adjustments, partial settlements, pending-versus-confirmed balances, expense changes/deletion, invalid input, large values, currency consistency and debt simplification/reconciliation.

API tests create persistent hangouts, join and rotate secure invitations, prevent duplicate membership, reject nonmember access, validate itemized expenses, change payer/expense data, protect financially linked member removal, prevent overpayment and unauthorized settlement actions, require creditor confirmation, enforce receiving-detail ownership and reopen a SQLite file to verify persistence. A stable idempotency key prevents duplicate expense creation. Production mode rejects demo authentication. Authentication tests verify Telegram HMAC and reject tampering, wrong tokens, expired and future data.

Browser tests create a hangout, add a local member, open its invitation in a second browser context, join as another identity, save and edit a shared expense, verify exact shares, inspect debt flow, record and confirm a partial settlement, switch language and theme, reload, and verify RTL persistence. The home screen is checked at desktop and 390px mobile widths, including Persian overflow checks. Real rendered screenshots were inspected for home, Persian mobile and debt flow. Screenshots are in ignored `artifacts/`.

## Genuine verification limits

- Live Telegram launch, BotFather setup, native sharing and device-specific BackButton behavior require an owned configured bot and real Telegram clients. Signed-fixture authentication and production rejection behavior were tested locally.
- HTTPS hosting, actual external payments and bank/wallet transfers were not performed. The application never processes or independently verifies payments.
- The in-app visible browser preview host was unavailable; local Microsoft Edge Playwright tests and rendered screenshots supplied browser verification.
- Two end-to-end tests cover the principal journeys; this is not a claim of exhaustive security auditing or testing on every Telegram WebView/device.

No public deployment or paid service was used. The primary reference image was not edited or deleted.
