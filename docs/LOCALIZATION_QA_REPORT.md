# Six-language localization QA

Verified locally on November 21, 2026 on `feat/dong-six-language-i18n`, based on `release/dong-vercel`. No push or deployment was performed.

## Dictionary coverage

| Locale | Keys | Missing | Extra |
| --- | ---: | ---: | ---: |
| English (en) | 290 | 0 | 0 |
| Persian (fa) | 290 | 0 | 0 |
| Armenian (hy) | 290 | 0 | 0 |
| German (de) | 290 | 0 | 0 |
| French (fr) | 290 | 0 | 0 |
| Russian (ru) | 290 | 0 | 0 |

English and Persian source dictionaries were compared with the feature branch base and preserved exactly apart from file separation and a type-only import. New dictionaries have no English fallback spread. Shared international terms such as Pizza, Taxi, Date, Name and Status can legitimately match English in another language; native language names, currencies, SQLite, Telegram and DONG are intentional exceptions.

## Executed checks

- TypeScript: passed.
- Translation completeness check: passed for all six locales.
- Unit/API tests: 39 passed across 7 files.
- Production build: passed, including the translation validation gate. Frontend JS is 448.27 kB (138.40 kB gzip).
- Dependency audit: zero vulnerabilities.
- Localization browser checks: all six languages at 320 and 768 px, light and dark themes, document language/direction, localStorage reload persistence, keyboard selection, six available options, Telegram detection/manual override and browser detection.
- Existing browser regressions cover multi-user expenses, private receiving details, settlements, account balances, interactive demo and the seven-width English/Persian matrix.

Screenshots for all six locales and both themes are in `artifacts/i18n/<locale>-<width>-<theme>.png` (24 images). They are generated local QA artifacts, not committed user data. Visual inspection found an Armenian serif fallback and touching bottom-navigation labels; a bundled Noto Sans Armenian font and wrapping grid navigation corrected both issues. New font licensing is included under `public/licenses/`.

An initial Telegram detection test failed because the Telegram SDK replaced the mock object. The test now intercepts the SDK request and supplies its own lifecycle-compatible mock. The corrected detection and manual override tests pass.

## Files and maintenance

- `src/i18n.ts` was split into `src/i18n/{index,en,fa,hy,de,fr,ru}.ts`.
- `src/LanguageSelector.tsx` is shared by header and settings.
- App, components, context and features use typed locale state and localized number/date formatting.
- Main imports the Armenian font; styles cover selector focus and long navigation labels.
- `scripts/i18n-check.ts`, `tests/i18n.test.ts` and `tests/e2e/i18n.spec.ts` add validation and regression coverage. Existing browser tests select languages through the new native select.
- Package files include the font and build validation command. README and LOCALIZATION.md document maintenance and terminology.

No business logic, backend source, schema, API contract, authentication, settlement rules, secrets, environment files or hosting configuration was changed.

## Remaining review

The new dictionaries were machine-drafted and edited for financial terminology and visible UI copy. Native-speaker editorial review of long-form and demo text is recommended before public release; automated completeness checks do not certify translation quality. No live Telegram iOS/Android verification was performed. Flag emoji are OS-rendered and may appear as regional indicator letters on Windows. The native select's popup is controlled by the browser/OS; viewport assertions cover the document and selector, not native operating-system popup geometry.

To review and merge locally after approval:

```powershell
git switch feat/dong-six-language-i18n
git diff --stat release/dong-vercel...HEAD
git diff release/dong-vercel...HEAD
npm run i18n:check
npm run typecheck
npm test
npm run build
git switch release/dong-vercel
git merge --no-ff feat/dong-six-language-i18n
```

These commands do not push or deploy.

Final complete browser run: **18 passed (3.0 minutes)** after the Armenian font and narrow-navigation fixes. This includes the five localization browser cases and all existing regressions.
