/**
 * captchaDecoder.ts
 *
 * Pure function to decode captcha response.
 * No shared state — 100% thread-safe for parallel execution.
 *
 * Current pattern (all 70 sites):
 *   - API returns { d: "<base64_encoded_text>" }
 *   - The value is Base64 encoded 3 times
 *   - Decoding 3 times yields plain text captcha
 *
 * Future-proof: accepts configurable iterations and field name.
 */

/**
 * Decode a Base64 string N times.
 *
 * @param encoded - The Base64 encoded string
 * @param iterations - How many times to decode (default: 3)
 * @returns Decoded plain text
 */
export function decodeBase64NTimes(
  encoded: string,
  iterations: number = 3
): string {
  let result = encoded;

  for (let i = 0; i < iterations; i++) {
    try {
      result = Buffer.from(result, 'base64').toString('utf8');
    } catch (error) {
      throw new Error(
        `Captcha decode failed at iteration ${i + 1}/${iterations}: ${error}`
      );
    }
  }

  return result.trim();
}

/**
 * Extract and decode captcha text from an API response JSON.
 *
 * @param responseData - The parsed JSON from the captcha API
 * @param field - The field name containing the encoded captcha (default: "d")
 * @param iterations - Number of Base64 decode iterations (default: 3)
 * @returns Decoded plain text captcha
 */
export function extractCaptchaText(
  responseData: Record<string, unknown>,
  field: string = 'd',
  iterations: number = 3
): string {
  if (!responseData || !responseData[field]) {
    throw new Error(
      `Captcha field "${field}" not found in response. ` +
      `Available keys: ${Object.keys(responseData || {}).join(', ') || 'none'}`
    );
  }

  const encodedValue = String(responseData[field]);
  return decodeBase64NTimes(encodedValue, iterations);
}