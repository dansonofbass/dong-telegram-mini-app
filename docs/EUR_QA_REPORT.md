# EUR support verification

Verified November 21, 2026 on `feat/dong-six-language-i18n`.

EUR was already supported by the backend enum, schema constraints, two-decimal precision, string-to-integer minor-unit parser, item allocation engine, balances and settlement logic. These were reused without backend, schema or calculation changes.

Changes:

- Create-hangout selector displays `EUR (€)` while submitting the existing `EUR` value.
- Shared UI formatting now formats EUR with Intl.NumberFormat currency style, a locale-positioned euro symbol and exactly two decimal places in all six languages. Other currencies retain their existing presentation and precision.
- Added EUR unit/API and browser regression coverage. No exchange rates, conversions or new service was introduced.

Actual results:

- `npm run typecheck`: passed.
- `npm test`: **41 passed across 8 files**, including all existing financial calculation tests.
- `npm run build`: passed, including all six translation completeness checks.
- `npm run test:e2e -- tests/e2e/eur.spec.ts`: **1 passed**.

The EUR API test creates three separate guest identities and joins them by invitation. A shared item priced at 2,550 cents produces exactly three 850-cent shares. The payer has paid 2,550 cents and consumed 850 cents, so the other two participants each owe that payer 850 cents. A debtor records an 850-cent cash settlement; creditor confirmation leaves only the other 850-cent debt outstanding.

Formatting tests check two fraction digits and the euro symbol for en, fa, hy, de, fr and ru, reject excess EUR input precision, and preserve AMD/USD/USDT formatting. Calculations and persistence use integer cents; division into display units occurs only in the presentation formatter.

The browser test creates a EUR hangout through the real selector, joins two independent browser identities, enters 25.50 through the expense form, verifies the stored 2550-cent value, then switches all six languages at 320 px. It checks the euro symbol, RTL/LTR direction, document overflow and exact ledger equality after every switch. Six screenshots are saved in `artifacts/eur/`. The Persian RTL rendering was visually inspected.

Two initial browser-test attempts exposed test-fixture mistakes: an overly strict label locator and use of the demo-only add-member route. The final test uses the accessible combobox role and real invitation joins; it passes. No authorization rules were relaxed.

No public deployment, push, schema migration or currency conversion was performed.

