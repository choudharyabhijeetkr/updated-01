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
import * as fs from 'fs';

const isLinux = process.platform === 'linux';
const isContainer = isLinux && (
  process.env.CONTAINER === 'true' ||
  process.env.DOCKER === 'true' ||
  Boolean(process.env.KUBERNETES_SERVICE_HOST) ||
  Boolean(process.env.CI) ||
  fs.existsSync('/.dockerenv') ||
  fs.existsSync('/run/.containerenv')
);

const getContainerLaunchArgs = () => {
  if (isContainer) {
    return ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  }
  return [];
};

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
          args: getContainerLaunchArgs(),
        },
      },
    },
    {
      name: 'Desktop-Firefox',
      use: {
        viewport: { width: 1920, height: 1080 },
        browserName: 'firefox',
        launchOptions: {
          args: getContainerLaunchArgs(),
        },
      },
    },
    {
      name: 'Desktop-Safari',
      use: {
        viewport: { width: 1920, height: 1080 },
        browserName: 'webkit',
        launchOptions: {
          args: getContainerLaunchArgs(),
        },
      },
    },
    {
      name: 'Desktop-Edge',
      use: {
        viewport: { width: 1920, height: 1080 },
        browserName: 'chromium',
        launchOptions: {
          args: getContainerLaunchArgs(),
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
          args: getContainerLaunchArgs(),
        },
      },
    },
    {
      name: 'iPhone 14-Firefox',
      use: {
        ...devices['iPhone 14'],
        browserName: 'firefox',
        launchOptions: {
          args: getContainerLaunchArgs(),
        },
      },
    },
    {
      name: 'iPhone 14-Safari',
      use: {
        ...devices['iPhone 14'],
        browserName: 'webkit',
        launchOptions: {
          args: getContainerLaunchArgs(),
        },
      },
    },
    {
      name: 'iPhone 14-Edge',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
        launchOptions: {
          args: getContainerLaunchArgs(),
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
          args: getContainerLaunchArgs(),
        },
      },
    },
    {
      name: 'Android-Firefox',
      use: {
        ...devices['Pixel 5'],
        browserName: 'firefox',
        launchOptions: {
          args: getContainerLaunchArgs(),
        },
      },
    },
    {
      name: 'Android-Safari',
      use: {
        ...devices['Pixel 5'],
        browserName: 'webkit',
        launchOptions: {
          args: getContainerLaunchArgs(),
        },
      },
    },
    {
      name: 'Android-Edge',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        launchOptions: {
          args: getContainerLaunchArgs(),
        },
      },
    },
  ],
});