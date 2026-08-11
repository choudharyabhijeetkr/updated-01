/**
 * utils/screenshot.ts
 *
 * Reusable screenshot capture utility for test automation scripts.
 * 
 * Usage in test scripts:
 *   await captureScreenshot(page, 'home-page');
 *   await captureScreenshot(page, 'application-form');
 *   await captureScreenshot(page, 'payment-page');
 */

import { Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Global execution-level store for captured screenshots in current test process
declare global {
  var __capturedScreenshots__: string[];
}

if (!globalThis.__capturedScreenshots__) {
  globalThis.__capturedScreenshots__ = [];
}

/**
 * Captures a named screenshot if Screenshot Capture mode is enabled in dashboard settings.
 *
 * When Screenshot Capture is OFF:
 *   - Ignores screenshot capture code immediately
 *   - Creates zero screenshot files or folders
 *   - Returns null
 *
 * When Screenshot Capture is ON:
 *   - Saves screenshot under: screenshots/<timestamp>/<spec-name>/<screenshotName>.png
 *   - Preserves screenshot name supplied by user
 *   - Does not overwrite screenshots from previous executions
 *   - Returns the relative screenshot path for reporting
 *
 * @param page Playwright Page instance
 * @param screenshotName Descriptive name supplied by user (e.g., 'home-page', 'application-form')
 * @returns Promise<string | null> Relative screenshot path or null if disabled/skipped
 */
export async function captureScreenshot(page: Page, screenshotName: string): Promise<string | null> {
  // Check whether Screenshot Capture is enabled in execution environment
  const isEnabled = process.env.ENABLE_SCREENSHOT_CAPTURE === 'true';
  if (!isEnabled) {
    return null;
  }

  try {
    if (!page || page.isClosed()) {
      return null;
    }

    // Get current execution session timestamp (e.g., 2026-08-09_20-15-30)
    const sessionTimestamp = process.env.SESSION_TIMESTAMP || getFallbackTimestamp();

    // Determine spec key (e.g., azerbaijan-visa)
    const specKey = process.env.CURRENT_SPEC_KEY || 'general';

    // Clean up screenshot filename
    let cleanName = screenshotName.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
    if (!cleanName.endsWith('.png')) {
      cleanName += '.png';
    }

    // Target folder structure: screenshots/<timestamp>/<spec-name>/
    const relativeDir = path.join('screenshots', sessionTimestamp, specKey);
    const fullDir = path.join(process.cwd(), relativeDir);
    fs.mkdirSync(fullDir, { recursive: true });

    const fullPath = path.join(fullDir, cleanName);
    const relativePath = path.join('screenshots', sessionTimestamp, specKey, cleanName).replace(/\\/g, '/');

    // Also mirror to reports/screenshots/ for static html report serving
    const reportsDir = path.join(process.cwd(), 'reports', 'screenshots', sessionTimestamp, specKey);
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportsFullPath = path.join(reportsDir, cleanName);

    // Capture screenshot
    await page.screenshot({
      path: fullPath,
      fullPage: true,
      timeout: 5000,
    });

    // Copy to reports directory for static report embedding
    if (fs.existsSync(fullPath)) {
      fs.copyFileSync(fullPath, reportsFullPath);
    }

    // Register captured screenshot in global list for baseTest fixture
    if (!globalThis.__capturedScreenshots__) {
      globalThis.__capturedScreenshots__ = [];
    }
    globalThis.__capturedScreenshots__.push(relativePath);

    return relativePath;
  } catch (err: any) {
    console.warn(`[captureScreenshot] Failed/skipped screenshot '${screenshotName}':`, err?.message || err);
    return null;
  }
}

/**
 * Clears recorded captured screenshots for fresh test execution.
 */
export function clearCapturedScreenshots(): void {
  globalThis.__capturedScreenshots__ = [];
}

/**
 * Returns recorded captured screenshots for current execution.
 */
export function getCapturedScreenshots(): string[] {
  return globalThis.__capturedScreenshots__ || [];
}

function getFallbackTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}
