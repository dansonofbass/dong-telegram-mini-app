import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  use: { baseURL: "http://localhost:3000", headless: true, channel: "msedge" },
  workers: 1,
  reporter: "list",
});
