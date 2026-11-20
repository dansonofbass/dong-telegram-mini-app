# Localization maintenance

DONG supports exactly en, fa, hy, de, fr and ru. English in `src/i18n/en.ts` defines the canonical 290 keys. Every other dictionary is a `Record<Key, string>`, so TypeScript rejects missing and extra keys. Dictionaries contain UI copy; user-entered names, expenses, currencies and the DONG brand are not translated.

To add a key, add its English value, supply the same key in all five other dictionaries, and call `t("key")` from the component. To update copy, edit the corresponding dictionary value once; every component using that key updates automatically. Do not copy visible strings into components or use English fallback values for incomplete locales. Native language names and flags are centralized in `src/i18n/index.ts`.

Run `npm run i18n:check` to detect missing, blank and extra entries. This check is part of `npm run build`, so a CI build fails if dictionaries are incomplete. Run `npm run i18n:check -- --unused` for candidate unused keys. This is a conservative source-literal scan: server error codes and dynamically selected keys can appear unused, so review their callers before removing anything. Existing keys are retained for compatibility. No script automatically rewrites translations when English changes.

Use `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` after updates. Browser locale coverage is in `tests/e2e/i18n.spec.ts`, and screenshots are written to ignored `artifacts/i18n/`.

The shared `LanguageSelector` uses a native select for keyboard, screen-reader and touch support. The header displays a compact flag/code overlay; settings displays the full native language name. The selector retains a visible focus outline, and flags are decorative indicators, not regional settings. Flag emoji appearance depends on the operating system; Windows can display regional indicator letters while Telegram mobile platforms normally render flags.

Selection persists under `dong-language`. A saved supported locale takes precedence over Telegram `language_code`, then browser locale when Telegram has no language. Regional variants normalize to their base language. Unsupported detection falls back to English. Persian alone uses RTL; all six update the document language and direction. Number/date formatting uses the selected language while financial calculations and currencies remain unchanged.

English and Persian dictionaries were preserved. New dictionaries were machine-drafted during authoring, then reviewed and corrected for financial terminology and visible UI copy. They are committed static files: the application has no translation API or additional backend service. Native-speaker editorial review of all long-form/demo copy is still recommended before public release. Noto Sans Armenian is bundled for Armenian glyphs; existing Lato and Noto Sans Arabic remain in use.

Terminology reference:

| Concept | HY | DE | FR | RU |
| --- | --- | --- | --- | --- |
| Expense split | Բաժանում | Aufteilung | Partage | Распределение |
| Balance | Մնացորդ | Saldo | Solde | Баланс |
| Tip | Թեյավճար | Trinkgeld | Pourboire | Чаевые |
| Settlement | Մարում | Ausgleich | Règlement | Погашение |
| Hangout | Հանդիպում | Treffen | Sortie | Встреча |
