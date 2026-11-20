# Deployment preparation

No public deployment has been performed. Use one Node process on a host with persistent local storage. Serverless ephemeral filesystems are unsuitable for this SQLite configuration.

1. Provision Node 22.13+ (24 recommended), persistent disk and an HTTPS reverse proxy.
2. Install with `npm ci`, then `npm run build`. Runtime startup uses TypeScript via `tsx`; retain that package when installing.
3. Set `NODE_ENV=production`, `DEMO_MODE=false`, `BOT_TOKEN`, `BOT_USERNAME`, `APP_SHORT_NAME`, `PUBLIC_URL`, `DATA_DIR`, and optionally `PORT`/`HOST`. Bind to loopback behind the proxy. Never use the local demo database as a live production database.
4. Run `npm start` under a service manager. It serves built assets and API from the same origin. Route HTTPS to the Node port, preserve request headers and configure reasonable proxy body/time limits.
5. Monitor `GET /api/health`. Keep a single writer process; do not cluster this application across independent SQLite files. The application enforces rate limits per verified Telegram identity or valid guest session; unauthenticated traffic uses an IP bucket. Configure trusted proxy handling only for a verified proxy topology if public traffic requires it.
6. Configure BotFather as described in TELEGRAM_SETUP.md and verify on actual Telegram mobile and desktop clients.

## Backups and upgrades

Stop the service before a filesystem backup, then copy the SQLite database and any `-wal`/`-shm` sidecars together to protected storage. Alternatively use SQLite's online backup API with a tested administrative backup job. Encrypt backups and restrict their access: receiving details and membership data are personal data. Restore into a separate directory and verify with a read-only smoke test before replacing a live file.

Schema migrations 1–3 run automatically and are tracked in the `migrations` table. The v1 migration is preserved. Forward migrations add identity/session metadata, immutable expense ownership, typed adjustments, activity, receiving methods, invitation expiry and version checks. Future migrations must be additive/versioned and tested on a backup. Startup never silently deletes or recreates an existing database.

Production rejects browser guests, predefined demo identity, missing/invalid/expired Telegram authentication and nonmembers. Set `PUBLIC_URL` to the exact public HTTPS origin; it is used to validate mutation origins behind a TLS proxy. Receiving values are optional and accessible only to their owner and relevant debtors, not all members. Lists are masked; details require an intentional authorized request. Never store CVV, PIN, expiry, passwords, seed phrases or private keys. DONG does not move or independently verify money.

Remaining external prerequisites: bot configuration, privately provisioned token, an HTTPS hostname/host with persistent disk, service manager, backup schedule and real-device Telegram verification. None require posting secrets into chat.
