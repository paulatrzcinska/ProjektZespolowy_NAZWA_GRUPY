import { defineConfig, devices } from "@playwright/test";

// This suite requires a prepared, dedicated PostgreSQL database and a real admin.
// The backend reads its ignored .env / .env.runtime; no contract server is used.
if (!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD)
  throw new Error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for the local test administrator.");
if (process.env.E2E_ALLOW_WRITES !== "local-test-database")
  throw new Error("Set E2E_ALLOW_WRITES=local-test-database after preparing a dedicated local database.");

const phase = process.env.E2E_PHASE ?? "crud";
if (!["crud", "restart", "offline"].includes(phase)) throw new Error("Unknown E2E_PHASE");
const external = process.env.E2E_EXTERNAL_SERVERS === "1";
if (phase === "offline" && !external)
  throw new Error("Offline check requires an existing frontend and a stopped backend (E2E_EXTERNAL_SERVERS=1).");

export default defineConfig({
  testDir: "./tests-live",
  testMatch: `${phase}.spec.ts`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4176",
    serviceWorkers: "block",
    // Login requests contain credentials: do not store traces or videos.
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: external ? undefined : [
    {
      command: "uv run --locked --directory ../backend uvicorn app.main:app --host 127.0.0.1 --port 18001",
      env: { API_MODE: "live", APP_ENV: "test" },
      url: "http://127.0.0.1:18001/health",
      timeout: 120_000,
    },
    {
      command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4176",
      env: { API_PROXY_TARGET: "http://127.0.0.1:18001", VITE_API_BASE_URL: "", VITE_USE_MOCK_API: "false" },
      url: "http://127.0.0.1:4176",
      timeout: 120_000,
    },
  ],
});
