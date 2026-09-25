import { defineConfig } from 'vitest/config';

// API end-to-end suite: runs against a live server (E2E_BASE_URL, default http://localhost:3000).
export default defineConfig({
  test: {
    include: ['tests/api/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
