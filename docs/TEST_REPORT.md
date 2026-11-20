# Vercel + Turso release preparation � November 21, 2026

Branch: release/dong-vercel; original base 8cedf36. The prior stash was not applied, and the original local SQLite database was not reset or deleted.

| Check | Actual result |
| --- | --- |
| TypeScript | Passed, including API entrypoint and migration scripts |
| Unit/API suite | 37 tests passed across 6 files |
| Playwright suite | 13 tests passed in final full run (3.7 minutes) |
| Production build | Passed; frontend JS 378.36 kB, gzip 116.51 kB |
| npm audit | Zero vulnerabilities |
| Local production HTTP smoke | / 200 HTML; /api/health 200 JSON; /api/me 401 JSON; /hangout/example/flow 200 HTML; /api/unknown 401 JSON |
| Node Function bridge | Real local HTTP tested for health, protected API, JSON fallback, initialization failure and retry |
| Async libSQL adapter | Local file/in-memory libSQL tested; no live Turso credentials used |
| Public Vercel runtime | Not verified; no public deployment or resource creation |
| Telegram iOS/Android | Not verified |

Deployment tests cover three signed Telegram identities, returning identity after app recreation, production guest rejection, idempotent expense creation, activity atomicity, optimistic conflict rejection, foreign keys, rollback, concurrent invitation requests, repeated joining, empty migration bootstrap, repeat migration, failed migration rollback, and sanitized cold-start failures with retry. Existing tests retain financial, HMAC, permission, receiving-method and settlement coverage. Tests use independent databases, including a unique browser database directory per run; Windows libSQL test files are retained in ignored artifacts because native handles can prevent immediate deletion.

The migration is explicitly authorized by CONFIRM_DATABASE_MIGRATION=yes and bootstraps an empty remote libSQL database to schema version 3 without demo data. It refuses unsupported existing remote schemas. Runtime only checks schema version. Transaction writes are batched and flushed before reads/commit, with per-transaction AsyncLocalStorage isolation.

Production source uses remote storage when configured and refuses local fallback on Vercel. Preview access requires explicit opt-in; actual separation of production and preview database credentials remains an operator responsibility. In-process rate limiting is best effort across function instances. Remote latency, Turso service errors, quota behavior and cross-instance remote contention remain unverified until a live disposable database is available.

Mobile scope and remaining device checks are documented in MOBILE_QA_REPORT.md. One intermediate browser run reported ERR_ABORTED on navigation; an isolated rerun and the final full run passed. The first test attempt under the sandbox failed because Vite could not read dependencies; the authorized Windows rerun succeeded.

Local production smoke server was started at http://localhost:3012 using artifacts/production-smoke, separate from existing data. Normal local development remains npm run dev at http://localhost:3000. No GitHub push or public deployment was performed.

---

# DONG account-wide debt, receiving and demo follow-up

Follow-up verification on November 20, 2026:

- **35 unit/API tests passed** across 5 files, including new tests for same-user cross-hangout offsets, separate currencies, duplicate names, private membership boundaries, confirmed versus pending settlements and Persian/Arabic card/account normalization. Verified users now have independent rate-limit buckets; anonymous requests retain an IP bucket. A regression verifies that one guest cannot exhaust another guest's allowance behind the same IP, while the per-user limit is still enforced.
- **All 6 browser tests passed together**, covering all saved debts in the home preview, a historical 3,000 AMD debt offset against a reverse 1,300 AMD debt (net 1,700 AMD), source breakdowns, a second independent counterparty, group carryover, reload persistence and privacy between users.
- The Persian receiving form was genuinely rendered. A short card returned specific inline guidance; Persian and Arabic card values then saved and edited successfully, with canonical value `6219861912345678` preserved after reload.
- The public nine-step demo was exercised from initial onboarding through three different expense creators, live 10% discount/5% service calculations, exact 14,595 AMD total, straight debt arrows, partial marking, creditor confirmation, history and a second shared hangout. The test verifies **zero real API mutations** and no authenticated identity created by the guide.
- The existing multi-user, settlement, RTL/theme and crowded-debt browser regression scenarios were rerun. Mobile demo overflow found during testing was fixed with constrained grid sizing and independently scrollable steps.
- Production build and TypeScript checks passed; dependency audit reported zero vulnerabilities. No database reset or public deployment was performed. Existing hangouts and the immutable reference image remain untouched.

New rendered screenshots include `artifacts/account-balances-desktop.png`, `carryover-mobile.png`, `receiving-fa-fixed.png`, `demo-multiple-creators.png`, `demo-flow-mobile.png` and `demo-history-mobile.png`.

The account view offsets only the same two identities in the same currency. It does not silently confirm payments or rewrite historical expense/settlement records. No conversion between currencies is performed.

The final app is bound to localhost's IPv6 loopback: `/api/health` returns `{"ok":true}` and `/demo` returns HTTP 200 at `http://localhost:3000`. Another existing process occupies IPv4 port 3000 and was left untouched. The default host and `.env.example` now use `localhost` so a normal development restart follows the verified address.

---

# Prior DONG v1.2 test report

Verified locally on November 20, 2026, on Windows with Node 24.18.0, npm 11.16.0 and installed Microsoft Edge. Work is on `feat/dong-v1-2-multiuser-activity`; no public deployment or push was performed.

## v1.2 executed checks

| Check | Actual result |
| --- | --- |
| Financial, authentication, API and migration tests | **28 passed**, 4 test files; includes the existing 17 regression tests adapted to authenticated guest sessions |
| Essential browser journeys | **3 passed** in the full suite |
| Crowded-layout follow-up | Passed with explicit no-overlap geometry assertions after screenshot review |
| TypeScript and production build | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Production root and SPA fallback | HTTP 200 |
| Production predefined demo authentication | HTTP 401 |
| Production guest registration | HTTP 403 |
| Primary app | Running at **http://localhost:3000**, health `ok: true`; new-user onboarding genuinely rendered in Edge |
| Existing database preservation | Record counts and ledger fingerprint unchanged after migrations; backup created before final migration |
| Design reference | Unchanged; verified against Git |

## Two-browser invitation outcome

The browser test registered Ali in browser context A, created a dinner and an expense, then copied its actual `/invite/TOKEN` URL. Context B opened that link fresh, refreshed during onboarding, registered Sara and was redirected to the **same original hangout** with Ali's expense visible. The identities differed. Sara created and edited her own expense, selected Ali as payer, and received HTTP 403 attempting to edit Ali's expense. Ali saw Sara's membership and new expense through synchronization. Both contexts retained their distinct identities and shared financial data after reload.

Ali added a preferred bank card. Only a masked preview appeared in lists; Sara intentionally opened its full value through the authorized settlement relationship. Sara marked a 1,000 AMD partial payment; only Ali could confirm. The calculated debt and rendered arrow amount changed from 4,500 to 3,500 AMD. Activity showed the correct actors and events.

## Additional coverage

- Guest IDs are opaque, independent of names, persistent across restart and stored through HttpOnly sessions. Predefined `Demo ali` impersonation is rejected. Production guest creation is disabled.
- Signed Telegram fixtures cover unique Telegram IDs mapped to internal IDs, first/last names, username/avatar metadata, first-launch confirmation, returning users and permanent selected names. Invalid, expired, tampered and future authentication remains rejected.
- Invitations cover repeated and simultaneous idempotent joins, invalid/revoked/expired tokens, unauthorized private reads and membership persistence.
- Expense tests cover creator/payer separation, spoofed ownership fields, member restrictions, explicit logged owner administration, stale revision conflicts and deletion integrity after confirmed payments.
- Adjustment tests cover the requested **19,900 AMD** example, percentage plus fixed components, discounted-subtotal calculation order, half-up rounding, equal/proportional allocations, invalid percentages, excessive discounts and unchanged historical fixed amounts.
- Activity tests cover server actors/resources/timestamps, sequence ordering, pagination, read authorization, persistence, immutable routes, idempotent expense events and transaction rollback if an event cannot be written.
- Receiving tests cover independent ownership, HTTP 403 for unauthorized edits/deletes/reads, masked lists, relevant-debtor-only values, card/account/wallet/cash methods, a unique preferred selection, redacted invitations/aggregate responses, no raw values in event metadata and preservation of settlement method references.
- Graph checks cover actual debtor/creditor direction, exact amounts, marker references, stable straight and cubic paths, settlement updates, 390px layouts, reduced motion and eight-debt crowded fallback. English/Persian and dark-theme screens were genuinely rendered and inspected.
- The migration test starts from the actual original v1 SQL schema and preserves old expenses, fixed adjustments, invitations, linked receiving information and confirmed payments through migrations 2 and 3 and another restart. The primary database was not reset or populated by E2E tests; those used isolated port 3001 and `artifacts/v12-e2e`.

Screenshots include `artifacts/v12-debt-desktop.png`, `v12-debt-mobile.png`, `v12-crowded-mobile.png`, `v12-activity.png`, `v12-flow-fa.png`, `v12-activity-fa.png`, `v12-settings-fa.png` and `v12-onboarding-localhost.png`. These are ignored local QA artifacts, not published assets.

## Remaining external verification

No local implementation blocker remains. Public HTTPS deployment, BotFather configuration, privately provisioned bot credentials and testing with two or three actual Telegram accounts remain the next stage. Native Telegram sharing, avatar delivery and device-specific WebView/BackButton behavior require that live setup. No payment or blockchain transfer was attempted. These tests are not an exhaustive security audit or a claim of coverage on every device.

Original v1 expenses did not have creator identity; the owner is preserved as their migration custodian and no historical activity is fabricated. Old shared-demo data remains stored but is not silently assigned to a new guest.

---

# Historical v1 verification

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
