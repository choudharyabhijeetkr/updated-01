/**
 * devices.ts
 *
 * Device configurations for Desktop, Android, and iPhone.
 * Used by configGenerator.js to create Playwright projects.
 * Also used by baseTest.ts for result metadata.
 */

export interface DeviceConfig {
  name: string;
  type: 'Desktop' | 'Mobile';
  playwrightDevice?: string; // Playwright built-in device name
  viewport?: { width: number; height: number };
  userAgent?: string;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export const DEVICES: Record<string, DeviceConfig> = {
  'Desktop': {
    name: 'Desktop',
    type: 'Desktop',
    viewport: { width: 1920, height: 1080 },
  },
  'Android': {
    name: 'Android',
    type: 'Mobile',
    playwrightDevice: 'Pixel 5',
  },
  'iOS': {
    name: 'iOS',
    type: 'Mobile',
    playwrightDevice: 'iPhone 14',
  },
};

export const DEVICE_LIST = Object.keys(DEVICES);

export interface BrowserConfig {
  name: string;
  playwrightBrowser: 'chromium' | 'firefox' | 'webkit';
  channel?: string;
}

export const BROWSERS: Record<string, BrowserConfig> = {
  'Chromium': {
    name: 'Chromium',
    playwrightBrowser: 'chromium',
  },
  'Firefox': {
    name: 'Firefox',
    playwrightBrowser: 'firefox',
  },
  'WebKit': {
    name: 'WebKit',
    playwrightBrowser: 'webkit',
  },
};

export const BROWSER_LIST = Object.keys(BROWSERS);