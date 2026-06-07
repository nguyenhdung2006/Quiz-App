// Minimal Playwright smoke-test config for the static vanilla frontend.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173/frontend/",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "node tests/static-server.mjs",
    url: "http://127.0.0.1:4173/frontend/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 10000
  }
});
