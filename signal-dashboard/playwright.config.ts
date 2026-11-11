import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: process.env.SIGNAL_PORTAL_URL || "http://127.0.0.1:10003",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox"],
    },
  },
  webServer: process.env.SIGNAL_PORTAL_URL ? undefined : {
    command: "npm run start -- -p 10003",
    url: "http://127.0.0.1:10003",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
