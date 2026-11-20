# Telegram setup

1. Open the verified @BotFather account in Telegram. Run /newbot, choose a name and unique username. Store the bot token only as TELEGRAM_BOT_TOKEN.
2. Use BotFather's Mini App management (/newapp where available) to create a named Mini App for that bot. Supply the deployed HTTPS Vercel origin, description and images. Save its short name as TELEGRAM_APP_SHORT_NAME and bot username without @ as TELEGRAM_BOT_USERNAME.
3. Configure the bot menu button to open the same HTTPS URL. APP_BASE_URL is this origin; it is separate from the Mini App short name.
4. Launch from Telegram. Production rejects browser demo guests. initData HMAC and age are verified on private requests; expired data requires reopening the Mini App. No process-memory session is authoritative.
5. With three separate Telegram accounts, complete first-time onboarding, create a hangout and share its generated link: `https://t.me/BOT_USERNAME/APP_SHORT_NAME?startapp=join_TOKEN`.
6. Open the link as the second and third users. Verify onboarding retains the invitation, joining is repeatable, members and prior expenses load, future allocations include the new members, and reload preserves names and membership.
7. Test invalid, expired and revoked invitation tokens; private ledger data must remain unavailable before joining. Check expense permissions, multiple payers, adjustments, receiving details, marking payment and creditor confirmation.
8. Repeat on real Telegram iOS and Android, checking keyboard, safe areas, fonts, RTL and dark mode. Desktop Playwright cannot certify Telegram WebView behavior.

No bot was created or configured during local preparation.
