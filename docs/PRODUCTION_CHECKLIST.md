# Production checklist

- [ ] Review release/dong-vercel changes and all local test reports.
- [ ] Test live Turso using a separate disposable libSQL database.
- [ ] Run migrations against an empty production database; verify zero demo users.
- [ ] Verify production/preview database and bot separation.
- [ ] Add secrets only to Vercel Production; confirm APP_BASE_URL matches the assigned HTTPS origin.
- [ ] Authorize GitHub push and public Vercel deployment separately.
- [ ] Verify SPA deep links, API 404, authentication, assets and health on Vercel.
- [ ] Test three Telegram accounts, invitation onboarding, concurrent joins, expenses and repeated settlement confirmation.
- [ ] Complete Telegram iOS/Android keyboard and safe-area checks.
- [ ] Review Turso and Vercel free-tier usage and backup/recovery procedures.

Existing local SQLite data remains preserved. There is no public reset endpoint.
