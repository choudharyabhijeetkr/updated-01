/**
 * Auto-generated single-execution Playwright config
 * Created: 2026-08-05T06:34:56.615Z
 * File: brazil-evisa.spec.ts
 * Project: Android-Chrome
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/spec',
  testMatch: '**/brazil-evisa.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 120000,
  expect: {
    timeout: 30000,
  },
  projects: [
    {
      name: 'Android-Chrome',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        launchOptions: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
      },
    },
  ],
});
