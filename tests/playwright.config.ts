import { defineConfig, devices } from '@playwright/test';

/**
 * Base URL comes from APP_BASE_URL only (app root or a screen URL), e.g.
 *   APP_BASE_URL=https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/
 * Without it, every spec skips (see helpers.requireBaseURL).
 * Run serially: npx playwright test --workers=1
 */
const baseURL = process.env.APP_BASE_URL;

export default defineConfig({
  testDir: '.',
  testMatch: ['**/*.spec.ts'],
  fullyParallel: true,
  retries: 0,
  // Personal-environment throttling: cold loads routinely take ~20s and the
  // waitForData helpers budget 120s of bounded Retry click-through, so the
  // default 30s test budget would kill slow-but-healthy loads mid-poll.
  // Per-assertion timeouts (toBeVisible etc.) still fail fast.
  timeout: 180000,
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
