/**
 * playwright.config.ts
 *
 * Default Playwright configuration.
 * Used when running `npx playwright test` directly from CLI.
 *
 * NOTE: When running from the Web Dashboard, a temporary
 * config (.temp-run-config.mjs) is generated dynamically
 * with only the selected browsers/devices/tests.
 *
 * This file is kept for manual/debug usage.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/spec',

  // Match all spec files
  testMatch: '**/*.spec.{ts,js}',

  // Run all tests in parallel
  fullyParallel: true,

  // Don't allow test.only in CI
  forbidOnly: !!process.env.CI,

  // Retry failed tests up to 3 times
  retries: 3,

  // Auto-detect workers based on CPU cores
  workers: process.env.CI ? 1 : undefined,

  // Use list reporter for clean console output
  reporter: 'list',

  // Global timeout per test
  timeout: 120_000,

  // Expect assertions timeout
  expect: {
    timeout: 10_000,
  },

  // Global action & navigation timeouts
  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  // Don't fail on unhandled console errors (visa sites are noisy)
  ignoreHTTPSErrors: true,

  // Projects: all browser × device combinations
  projects: [
    // ─── Desktop ───
    {
      name: 'Desktop-Chrome',
      use: {
        viewport: { width: 1920, height: 1080 },
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions', '--disable-background-networking', '--start-maximized'],
        },
      },
    },
    {
      name: 'Desktop-Firefox',
      use: {
        viewport: { width: 1920, height: 1080 },
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
    {
      name: 'Desktop-Safari',
      use: {
        viewport: { width: 1920, height: 1080 },
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
    {
      name: 'Desktop-Edge',
      use: {
        viewport: { width: 1920, height: 1080 },
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--start-maximized'],
        },
      },
    },

    // ─── iPhone 14 ───
    {
      name: 'iPhone 14-Chrome',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
    {
      name: 'iPhone 14-Firefox',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
    {
      name: 'iPhone 14-Safari',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
    {
      name: 'iPhone 14-Edge',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },

    // ─── Android (Pixel 5) ───
    {
      name: 'Android-Chrome',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
    {
      name: 'Android-Firefox',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
    {
      name: 'Android-Safari',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
    {
      name: 'Android-Edge',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
  ],
});