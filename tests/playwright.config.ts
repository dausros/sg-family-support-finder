import { defineConfig, devices } from '@playwright/test';

/**
 * Base URL is configurable via APP_BASE_URL.
 * Example (do NOT hardcode a live URL here):
 *   APP_BASE_URL=https://<env>.outsystemsenterprise.com/SGFamilySupportFinder/FindCentres
 *
 * Status: BLOCKED — no published URL exists yet (O11 build pending).
 * Tests must not be run until APP_BASE_URL points at a user-approved publish.
 */
const baseURL = process.env.APP_BASE_URL;

export default defineConfig({
  testDir: '.',
  testMatch: ['**/*.spec.ts'],
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...(baseURL ? { baseURL } : {}),
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
