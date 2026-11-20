import type { IncomingMessage, ServerResponse } from "node:http";
import type { createApp } from "./app.js";
export function createNodeHandler(build: () => ReturnType<typeof createApp>) {
  let application: ReturnType<typeof createApp> | undefined;
  return async (request: IncomingMessage, response: ServerResponse) => {
    try {
      application ??= build().catch((error) => {
        application = undefined;
        throw error;
      });
      const app = await application;
      await app.ready();
      app.server.emit("request", request, response);
    } catch {
      application = undefined;
      response.statusCode = 503;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ error: "unavailable" }));
    }
  };
}
