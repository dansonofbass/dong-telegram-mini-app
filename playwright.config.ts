import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  use: { baseURL: "http://localhost:3001", headless: true, channel: "msedge" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3001/api/health",
    reuseExistingServer: false,
    env: { PORT: "3001", DATA_DIR: `./artifacts/e2e-${Date.now()}`, DEMO_MODE: "true" },
    timeout: 60000,
  },
  workers: 1,
  reporter: "list",
});
