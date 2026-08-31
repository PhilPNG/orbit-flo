import { defineConfig, devices } from "playwright/test";

const port = process.env.E2E_PORT || "5173";
const baseURL = `http://127.0.0.1:${port}`;

const webServer =
  process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1"
    ? undefined
    : {
        command:
          `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: true,
      };

export default defineConfig({
  testDir: "./tests/e2e",
  webServer,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.E2E_BROWSER_CHANNEL || undefined,
        headless: process.env.E2E_HEADED !== "1",
      },
    },
  ],
});
