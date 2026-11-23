import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // iPhone-size viewport, touch and user agent, run in Chromium.
  projects: [{ name: "iphone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: true,
    timeout: 120_000,
    // Lets the daily-summary test call the cron route. A dev server you started yourself needs the same
    // value in .env.local (see .env.example).
    env: { CRON_SECRET: process.env.CRON_SECRET ?? "e2e-cron-secret-for-local-tests-only" },
  },
});
