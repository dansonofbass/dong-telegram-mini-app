# Telegram setup

Local browser mode works without credentials. Real Telegram verification cannot be tested without an owned bot and an HTTPS deployment.

1. Create or select a bot with BotFather, configure its Mini App and note the bot username and app short name.
2. Set `BOT_TOKEN` privately on the server, never in a client variable or Git. Set `BOT_USERNAME`, `APP_SHORT_NAME`, `PUBLIC_URL` and `DEMO_MODE=false`.
3. Build the client, start production behind HTTPS and configure that HTTPS URL as the Mini App URL in BotFather.
4. Launch from Telegram. The official script supplies `Telegram.WebApp`; the client sends raw `initData` in an authorization header. The server verifies HMAC, constant-time hash equality and a one-hour maximum age before creating/updating identity.
5. Test a generated `https://t.me/BOT_USERNAME/APP_SHORT_NAME?startapp=join_TOKEN` link with a second Telegram account. A validated identity must explicitly join before private data is accessible.

The Telegram BackButton follows page navigation; native Telegram sharing is used when available. A browser fallback uses Telegram's share URL. In local demo mode invitations use a separate `/join/TOKEN` browser path. Token regeneration revokes previous invitation links without removing current members.

An expired session requires reopening the Mini App to obtain fresh initData. Client-provided user IDs are never used as Telegram identity.

Reference: [official Telegram Mini Apps documentation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
