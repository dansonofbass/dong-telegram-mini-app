import { createApp } from "./app";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
if (existsSync(".env")) loadEnvFile(".env");
const production =
  process.argv.includes("--production") ||
  process.env.NODE_ENV === "production";
if (production) {
  process.env.NODE_ENV = "production";
  if (process.env.DEMO_MODE === "true")
    throw Error("DEMO_MODE must be false in production");
  if (!process.env.BOT_TOKEN)
    throw Error("BOT_TOKEN is required in production");
}
const app = await createApp({ production });
if (production) {
  await app.register((await import("@fastify/static")).default, {
    root: resolve("dist"),
  });
  app.setNotFoundHandler((r, reply) =>
    r.url.startsWith("/api/")
      ? reply.code(404).send({ error: "validation" })
      : reply.sendFile("index.html"),
  );
} else {
  const vite = await (
    await import("vite")
  ).createServer({
    configLoader: "runner",
    server: {
      middlewareMode: true,
      hmr: { port: Number(process.env.PORT || 3000) + 20000 },
    },
    appType: "spa",
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/"))
      return reply.code(404).send({ error: "validation" });
    reply.hijack();
    vite.middlewares(req.raw, reply.raw, () => {
      reply.raw.statusCode = 404;
      reply.raw.end();
    });
  });
  app.addHook("onClose", () => vite.close());
}
await app.listen({
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "127.0.0.1",
});
console.log(
  `DONG is running at http://localhost:${process.env.PORT || 3000} (${production ? "production" : "local demo"})`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => app.close().then(() => process.exit(0)));
