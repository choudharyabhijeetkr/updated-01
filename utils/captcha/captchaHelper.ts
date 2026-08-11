/**
 * captchaHelper.ts
 *
 * High-level helper that combines response waiting + decoding.
 * Returns a Promise<string> so the test can:
 *
 *   1. Call this BEFORE page.goto()
 *   2. Fill other form fields while captcha loads in background
 *   3. Await the promise when ready to fill the captcha field
 *
 * Thread-safe: each call creates its own waitForResponse listener.
 * No shared state between parallel test workers.
 */

import { Page, Response } from '@playwright/test';
import { extractCaptchaText } from './captchaDecoder';

// ─── Configurable defaults (same for all 70 sites currently) ───

const DEFAULT_CAPTCHA_CONFIG = {
  /** URL pattern to identify the captcha API response */
  urlPattern: 'create_captcha.php',

  /** Expected HTTP status */
  expectedStatus: 200,

  /** JSON field containing the encoded captcha */
  responseField: 'd',

  /** Number of Base64 decode iterations */
  decodeIterations: 3,

  /** How long to wait for the captcha response (ms) */
  timeout: 20000,
};

// ─── Per-website overrides (for future use) ───

type CaptchaConfig = typeof DEFAULT_CAPTCHA_CONFIG;

const SITE_OVERRIDES: Record<string, Partial<CaptchaConfig>> = {
  // Example for future site with different pattern:
  // 'armenia-visa': {
  //   urlPattern: 'generate_captcha',
  //   responseField: 'captcha_text',
  //   decodeIterations: 1,
  // },
};

/**
 * Get merged config for a website key.
 */
function getConfig(siteKey?: string): CaptchaConfig {
  const overrides = siteKey ? SITE_OVERRIDES[siteKey] || {} : {};
  return { ...DEFAULT_CAPTCHA_CONFIG, ...overrides };
}

/**
 * Wait for the captcha API response and return decoded text.
 *
 * IMPORTANT: Call this BEFORE page.goto() or the action that
 * triggers the captcha API call.
 *
 * @param page - Playwright Page object
 * @param siteKey - Optional website identifier for per-site config
 * @returns Promise that resolves to the decoded captcha text
 *
 * @example
 * ```typescript
 * // Set up captcha listener BEFORE navigation
 * const captchaPromise = waitForCaptcha(page);
 *
 * // Navigate (triggers captcha API call)
 * await page.goto('https://example.com/apply/');
 *
 * // Fill other fields while captcha response loads
 * await page.getByRole('textbox', { name: 'name' }).fill('John');
 * await page.getByRole('textbox', { name: 'email' }).fill('john@test.com');
 *
 * // Now await the captcha text
 * const captchaText = await captchaPromise;
 * await page.getByRole('textbox', { name: 'Captcha' }).fill(captchaText);
 * ```
 */
export function waitForCaptcha(
  page: Page,
  siteKey?: string
): Promise<string> {
  const config = getConfig(siteKey);

  // Set up the response listener BEFORE any navigation with graceful catch handler
  const responsePromise: Promise<Response> = page
    .waitForResponse(
      (response) =>
        response.url().includes(config.urlPattern) &&
        response.status() === config.expectedStatus,
      { timeout: config.timeout }
    )
    .catch((err) => {
      throw new Error(`[Captcha Guard] Captcha API response ('${config.urlPattern}') not detected within ${config.timeout / 1000}s: ${err.message}`);
    });

  // Chain: wait for response → parse JSON → decode captcha
  const resultPromise = responsePromise.then(async (response) => {
    try {
      const data = await response.json();
      return extractCaptchaText(
        data,
        config.responseField,
        config.decodeIterations
      );
    } catch (err: any) {
      throw new Error(`[Captcha Guard] Failed to parse/decode captcha response: ${err.message}`);
    }
  });

  // Attach silent catch to prevent unhandled promise rejections when unawaited by test
  resultPromise.catch(() => {});

  return resultPromise;
}

/**
 * Wait for captcha with custom URL pattern (for one-off overrides).
 *
 * @param page - Playwright Page object
 * @param urlPattern - Custom URL pattern to match
 * @param field - Custom JSON field name
 * @param iterations - Custom decode iterations
 */
export function waitForCaptchaCustom(
  page: Page,
  urlPattern: string,
  field: string = 'd',
  iterations: number = 3
): Promise<string> {
  const responsePromise: Promise<Response> = page
    .waitForResponse(
      (response) =>
        response.url().includes(urlPattern) &&
        response.status() === 200,
      { timeout: 20000 }
    )
    .catch((err) => {
      throw new Error(`[Captcha Guard] Custom Captcha API response ('${urlPattern}') not detected within 20s: ${err.message}`);
    });

  const resultPromise = responsePromise.then(async (response) => {
    try {
      const data = await response.json();
      return extractCaptchaText(data, field, iterations);
    } catch (err: any) {
      throw new Error(`[Captcha Guard] Failed to parse/decode custom captcha response: ${err.message}`);
    }
  });

  // Attach silent catch to prevent unhandled promise rejections when unawaited by test
  resultPromise.catch(() => {});

  return resultPromise;
}