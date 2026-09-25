import { defineConfig, devices } from '@playwright/test';

// Browser end-to-end tests. Expects the app running at E2E_BASE_URL (default http://localhost:3000) with
// ENABLE_DEV_LOGIN=true and a freshly seeded database (`npm run db:reset`).
export default defineConfig({
  testDir: 'tests/ui',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
});
