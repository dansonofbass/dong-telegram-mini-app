# Telegram setup

Local browser mode works without credentials. Real Telegram verification cannot be tested without an owned bot and an HTTPS deployment.

1. Create or select a bot with BotFather, configure its Mini App and note the bot username and app short name.
2. Set `BOT_TOKEN` privately on the server, never in a client variable or Git. Set `BOT_USERNAME`, `APP_SHORT_NAME`, `PUBLIC_URL` and `DEMO_MODE=false`.
3. Build the client, start production behind HTTPS and configure that HTTPS URL as the Mini App URL in BotFather.
4. Launch from Telegram. The official script supplies `Telegram.WebApp`; the client sends raw `initData` in an authorization header. The server verifies HMAC, constant-time hash equality and a one-hour maximum age, then finds the unique verified Telegram ID mapped to an internal user ID. First-time users confirm or edit their display name. That chosen name is permanent and is not overwritten by Telegram profile refreshes. First name, last name, username and HTTPS avatar metadata are refreshed separately.
5. Test a generated `https://t.me/BOT_USERNAME/APP_SHORT_NAME?startapp=join_TOKEN` link with a second Telegram account. A validated identity must explicitly join before private data is accessible.

The Telegram BackButton follows page navigation; native Telegram sharing is used when available. A browser fallback uses Telegram's share URL. Local development invitations use `/invite/TOKEN`; old `/join/TOKEN` paths remain compatible. The token stays in the URL while confirming a name and is consumed only by an authenticated join. Invitations expire after 30 days; regeneration revokes previous links without removing current members. Production never substitutes placeholder bot links: if the real bot username or short name is missing, copy/share stays disabled.

## Real-account acceptance checklist

After HTTPS deployment (not performed in this task), open the configured bot with two or three actual Telegram accounts. Confirm different internal identities and persistent chosen names; create one hangout; invite the others; add expenses from each account; verify creator/payer separation and forbidden edits; configure receiving methods independently; record a partial manual settlement and have its creditor confirm; inspect the Activity timeline and updated debt arrows; reopen the Mini App in both English and Persian. Do not use guest sessions in production. No OTP, Telegram password or mandatory phone number is requested.

Locally, signed Telegram fixtures verify first-launch confirmation, returning-user recognition, metadata, persistent names and rejection of guest authentication in production. They do not substitute for real Telegram device testing.

An expired session requires reopening the Mini App to obtain fresh initData. Client-provided user IDs are never used as Telegram identity.

Reference: [official Telegram Mini Apps documentation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
