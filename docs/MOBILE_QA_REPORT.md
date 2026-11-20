# Mobile QA — Vercel release preparation

Executed November 21, 2026 with Playwright and Microsoft Edge on Windows.

All seven viewport cases passed: **320, 360, 375, 390, 414, 430 and 768 px**, at 844 px height. Each case renders English LTR and Persian RTL routes and saves full-page screenshots under `artifacts/mobile/` (203 screenshots total: seven onboarding images plus 196 route images).

Rendered routes include onboarding (English), home, create hangout, invitation preview, receiving methods with the add form open, settings, activity, account flow, hangout expenses, expense entry with custom member weights and percentage adjustments, members, debt flow, manual settlement, hangout settings and invite sharing. Assertions check the main content, expected document direction, and document horizontal overflow. The existing end-to-end scenarios additionally exercise actual expense saving, private receiving values, partial settlement, confirmation, activity, Persian validation, dark theme and crowded debt arrow geometry.

Visual inspection included the 320 px Persian debt graph and receiving form, and the 320 px English expense/custom-weight/percentage form. No horizontal overflow was found in the tested matrix. Existing mobile layout was retained; no CSS redesign was necessary. Fixed navigation overlaps the viewport portion of long full-page screenshots while the page remains scrollable; bottom content has existing spacing.

Limits: these automated assertions do not establish every button's accessibility or every possible long user value. Dark mode has the existing regression coverage rather than every route/viewport combination. Persian onboarding, operating-system keyboard behavior, notches, Telegram safe-area integration and real iOS/Android WebViews still require live device QA. No claim of physical-device verification is made.

An intermediate browser run had one interrupted navigation (ERR_ABORTED); the isolated rerun and final complete 13-test run passed. Browser execution required normal Windows permissions because sandboxed Vite could not read installed dependencies.
