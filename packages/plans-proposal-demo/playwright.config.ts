import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  outputDir: "./test-results",
  use: {
    baseURL: "http://127.0.0.1:5175",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: ["--no-sandbox"]
    }
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: true,
    timeout: 30000
  }
});
