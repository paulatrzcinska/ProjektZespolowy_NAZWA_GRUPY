import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4175",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /pwa\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /catalogue\.spec\.ts/,
    },
    {
      name: "pwa",
      use: { ...devices["Desktop Chrome"], serviceWorkers: "allow" },
      testMatch: /pwa\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command:
        "uv run --locked --directory ../backend uvicorn app.main:app --host 127.0.0.1 --port 18000",
      env: { API_MODE: "contract", APP_ENV: "test" },
      url: "http://127.0.0.1:18000/health",
      timeout: 120_000,
    },
    {
      command:
        "npm run build && npm run preview -- --host 127.0.0.1 --port 4175",
      env: {
        API_PROXY_TARGET: "http://127.0.0.1:18000",
        VITE_API_BASE_URL: "",
      },
      url: "http://127.0.0.1:4175",
      timeout: 120_000,
    },
  ],
});
