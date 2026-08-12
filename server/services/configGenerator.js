/**
 * configGenerator.js
 *
 * Generates a Playwright config for exactly ONE (testFile, browser, device)
 * execution. The framework now runs executions one at a time (a queue),
 * so each Playwright process only ever needs a single project + single
 * test file — this removes the ambiguity that caused duplicate/incorrectly
 * matched results under the old "one big multi-project config" model.
 *
 * NOTE ON BROWSER MAPPING (bug fix):
 * The previous version of this file mapped every browser name
 * (Chrome/Firefox/Safari/Edge) to Playwright's `chromium` engine, so
 * selecting "Firefox" or "Safari" silently ran Chromium instead. This
 * version mirrors the (correct) mapping already used in utils/devices.ts.
 */

const path = require('path');
const fs = require('fs');

// ─── Browser Engine → Playwright engine mapping ───

const BROWSER_MAP = {
  'Chromium': { browserName: 'chromium' },
  'Firefox':  { browserName: 'firefox' },
  'WebKit':   { browserName: 'webkit' },
  // Fallbacks for legacy/backwards compatibility
  'Chrome':   { browserName: 'chromium' },
  'Safari':   { browserName: 'webkit' },
  'Edge':     { browserName: 'chromium' },
};

// ─── Platform → viewport / Playwright device mapping ───

const DEVICE_MAP = {
  'Desktop': {
    type: 'desktop',
    viewport: { width: 1920, height: 1080 },
    resolution: '1920x1080',
  },
  'Android': {
    type: 'mobile',
    playwrightDevice: 'Pixel 5',
    resolution: '393x851',
  },
  'iOS': {
    type: 'mobile',
    playwrightDevice: 'iPhone 14',
    resolution: '390x844',
  },
  // Fallback for legacy requests
  'iPhone 14': {
    type: 'mobile',
    playwrightDevice: 'iPhone 14',
    resolution: '390x844',
  },
};

function isContainerEnvironment() {
  if (process.platform !== 'linux') return false;
  return Boolean(
    process.env.CONTAINER === 'true' ||
    process.env.DOCKER === 'true' ||
    process.env.KUBERNETES_SERVICE_HOST ||
    process.env.CI ||
    fs.existsSync('/.dockerenv') ||
    fs.existsSync('/run/.containerenv')
  );
}

function getLaunchArgs() {
  if (isContainerEnvironment()) {
    return ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  }
  return [];
}

/**
 * Build the Playwright config source for a single execution.
 *
 * @param {Object} options
 * @param {string} options.testFile - Spec filename relative to configured test directory
 * @param {string} options.browser - One of BROWSER_MAP keys
 * @param {string} options.device - One of DEVICE_MAP keys
 * @param {number} options.retries - Max retries for this execution
 * @param {boolean} options.headless - Headless mode
 * @returns {string} Config file source
 */
function generateSingleExecutionConfig({ testFile, browser, device, retries, headless }) {
  const browserCfg = BROWSER_MAP[browser];
  const deviceCfg = DEVICE_MAP[device];

  if (!browserCfg) throw new Error(`Unknown browser: ${browser}`);
  if (!deviceCfg) throw new Error(`Unknown device: ${device}`);
  if (!testFile) throw new Error('testFile is required');

  const projectName = `${device}-${browser}`;
  const testDir = process.env.TEST_DIR || './tests/spec';
  const normalizedTestDir = testDir.replace(/\\/g, '/');
  const normalizedTestFile = testFile.replace(/\\/g, '/');

  const useLines = [];
  if (deviceCfg.playwrightDevice) {
    useLines.push(`...devices['${deviceCfg.playwrightDevice}'],`);
  } else if (deviceCfg.viewport) {
    useLines.push(`viewport: { width: ${deviceCfg.viewport.width}, height: ${deviceCfg.viewport.height} },`);
  }
  useLines.push(`browserName: '${browserCfg.browserName}',`);
  if (browserCfg.channel) {
    useLines.push(`channel: '${browserCfg.channel}',`);
  }
  useLines.push(`actionTimeout: 15000,`);
  useLines.push(`navigationTimeout: 30000,`);

  const launchArgs = getLaunchArgs();
  useLines.push(`launchOptions: {
        headless: ${headless},
        args: ${JSON.stringify(launchArgs)},
      },`);

  return `/**
 * Auto-generated single-execution Playwright config
 * Created: ${new Date().toISOString()}
 * File: ${testFile}
 * Project: ${projectName}
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '${normalizedTestDir}',
  testMatch: '**/${normalizedTestFile}',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: ${retries},
  workers: 1,
  reporter: 'list',
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  projects: [
    {
      name: '${projectName}',
      use: {
        ${useLines.join('\n        ')}
      },
    },
  ],
});
`;
}

/**
 * Write a generated config string to a uniquely-named temp file so that
 * sequential (or, in theory, overlapping) executions never collide on
 * the same config path.
 */
function writeConfig(configStr, filename) {
  const configPath = path.join(process.cwd(), filename);
  fs.writeFileSync(configPath, configStr, 'utf8');
  return configPath;
}

function cleanupConfig(configPath) {
  try {
    if (configPath && fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (err) {
    console.error('[configGenerator] Cleanup failed:', err.message);
  }
}

module.exports = {
  BROWSER_MAP,
  DEVICE_MAP,
  generateSingleExecutionConfig,
  writeConfig,
  cleanupConfig,
};