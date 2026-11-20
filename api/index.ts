import { createApp } from "../server/app";
import { createNodeHandler } from "../server/node-handler";
export default createNodeHandler(async () => {
  if (
    !process.env.TELEGRAM_BOT_TOKEN ||
    !process.env.APP_BASE_URL?.startsWith("https://")
  )
    throw Error("Production configuration required");
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)
    throw Error("Remote database required");
  return createApp({ production: true });
});
