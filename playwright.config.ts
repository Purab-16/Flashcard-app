import { defineConfig, devices } from "@playwright/test";

// The test account lives in tests/.env.test (created by hand, never committed). See tests/.env.example.
try {
  process.loadEnvFile("tests/.env.test");
} catch {
  // Missing file: signed-in tests will say what to do.
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const storageState = "tests/.auth/user.json";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure" },
  // Reuses a dev server that is already running, otherwise starts one.
  webServer: { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "public",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "desktop",
      testIgnore: [/auth\.setup\.ts/, /public\.spec\.ts/, /mobile\.spec\.ts/],
      use: { ...devices["Desktop Chrome"], storageState },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"], storageState },
      dependencies: ["setup"],
    },
  ],
});
