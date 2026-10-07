import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const chromium =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const python =
  process.env.PLAYWRIGHT_PYTHON ||
  (existsSync(".venv/bin/python") ? ".venv/bin/python" : "python3");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1100 },
    launchOptions: { executablePath: chromium, args: ["--no-sandbox"] },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `${python} -m uvicorn backend.app:app --host 127.0.0.1 --port 8000`,
      url: "http://127.0.0.1:8000/health",
      env: { KHAMI_ENGINE_MODULE: "" },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
