/**
 * image-spacing-audit.js
 * -------------------------------------------------------------------------
 * Crawls a website's sitemap, visits every page, and flags every visible
 * <img> that is NOT visually aligned with its section's content area at
 * any of the given viewport widths — shifted left/right, overflowing the
 * content container, or unevenly centered. Writes a plain-text report
 * with the failing cases (plus a separate "verified aligned" list for
 * spot-checking).
 *
 * USAGE:
 *   1. npm install playwright
 *   2. npx playwright install chromium
 *   3. Edit the CONFIG block below (domain + screen widths), OR pass them
 *      as CLI args:
 *        node image-spacing-audit.js https://example.com 320,375,768,1024
 *   4. node image-spacing-audit.js
 *
 * OUTPUT:
 *   image-spacing-report.txt in the current working directory: a FAILURES
 *   section followed by an IGNORED (verified aligned) section.
 *
 * Notes:
 *   - Only same-domain page URLs from the sitemap are crawled.
 *   - Non-page URLs (images, pdf, video, zip, etc.) are ignored.
 *   - URLs matching any keyword in CONFIG.SKIP_URL_KEYWORDS (case-insensitive)
 *     are skipped entirely and logged to the console.
 *   - Broken/failing pages are logged to the console and skipped; the
 *     crawl continues.
 *   - Alignment is judged against each image's actual content container,
 *     found by climbing ancestors based on layout characteristics (not a
 *     fixed number of parents) — see collectAlignmentIssues().
 *   - Duplicate entries (same page + image + width) are removed automatically.
 * -------------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// ============================================================================
// CONFIG - the only section you normally need to change
// ============================================================================
const CONFIG = {
  // Website to scan (must have a reachable sitemap.xml)
  DOMAIN: process.argv[2] || 'https://bahrain-visas.com/',

  // Viewport widths to test, in pixels. Easy to extend/shrink.
  SCREEN_WIDTHS: process.argv[3]
    ? process.argv[3].split(',').map(n => parseInt(n.trim(), 10))
    : [425],

  // Where to look for the sitemap (tried in order until one works)
  SITEMAP_CANDIDATES: ['/sitemap.xml', '/sitemap_index.xml'],

  // Output report path
  OUTPUT_FILE: path.join(process.cwd(), 'image-spacing-report.txt'),

  // How many pages to process in parallel
  CONCURRENCY: 4,

  // Max navigation time per page (ms)
  PAGE_TIMEOUT: 30000,

  // File extensions to treat as "not a page" and skip
  NON_PAGE_EXTENSIONS: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.mp4', '.mov', '.avi', '.wmv', '.mkv', '.webm',
    '.mp3', '.wav', '.ogg',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.xml', '.json', '.txt', '.css', '.js', '.rss'
  ],

  // Any page URL containing one of these keywords (case-insensitive) is
  // skipped entirely: not visited, not scanned. Add/remove freely.
  SKIP_URL_KEYWORDS: [
    'embassy',
    'consulate',
    'apply-evisa-from-',
    'community'
  ],

  // --- Alignment-detection tuning -------------------------------------
  // Max px difference between left gap and right gap still considered
  // "visually centered" / correctly aligned.
  ALIGNMENT_TOLERANCE: 8,

  // A gap more negative than -OVERFLOW_TOLERANCE means the image extends
  // outside the content container on that side (real overflow, not just
  // sub-pixel rounding noise).
  OVERFLOW_TOLERANCE: 2,

  // While climbing from the image toward the page root, an ancestor is
  // treated as the "content container" once it is at least this many px
  // narrower than the next ancestor above it — i.e. the point where a
  // deliberate width constraint (max-width, padding, fixed width) is
  // introduced.
  CONTAINER_WIDTH_DIVERGENCE: 24,

  // An ancestor whose width is within this many px of the image's own
  // width is a "tight wrapper" (e.g. <a>, <picture>, <figure> hugging the
  // image) and is skipped when looking for the real content container.
  TIGHT_WRAPPER_TOLERANCE: 4,
};

// ============================================================================
// SITEMAP HANDLING
// ============================================================================

/**
 * Fetch a URL's text body using the global fetch API (Node 18+/Playwright's
 * bundled Node usually satisfies this; falls back to https if unavailable).
 */
async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Extract all <loc>...</loc> values from raw sitemap XML text. */
function extractLocs(xml) {
  const matches = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)];
  return matches.map(m => m[1].trim());
}

/** Returns true if the XML looks like a sitemap index (points to other sitemaps). */
function isSitemapIndex(xml) {
  return /<sitemapindex/i.test(xml);
}

/**
 * Recursively resolve a sitemap (or sitemap index) into a flat list of URLs.
 */
async function resolveSitemap(url, seen = new Set(), depth = 0) {
  if (depth > 5 || seen.has(url)) return [];
  seen.add(url);

  let xml;
  try {
    xml = await fetchText(url);
  } catch (err) {
    console.warn(`  [sitemap] could not fetch ${url}: ${err.message}`);
    return [];
  }

  const locs = extractLocs(xml);
  if (isSitemapIndex(xml)) {
    let all = [];
    for (const childUrl of locs) {
      const childUrls = await resolveSitemap(childUrl, seen, depth + 1);
      all = all.concat(childUrls);
    }
    return all;
  }
  return locs;
}

/** Try each sitemap candidate path until one returns URLs. */
async function findAllPageUrls(domain) {
  const base = domain.replace(/\/+$/, '');
  for (const candidate of CONFIG.SITEMAP_CANDIDATES) {
    const sitemapUrl = base + candidate;
    console.log(`Trying sitemap: ${sitemapUrl}`);
    const urls = await resolveSitemap(sitemapUrl);
    if (urls.length > 0) {
      console.log(`  Found ${urls.length} URL(s) in ${sitemapUrl}`);
      return urls;
    }
  }
  throw new Error(`No usable sitemap found at ${CONFIG.SITEMAP_CANDIDATES.join(', ')}`);
}

/** True if the URL points at a non-page resource (image, pdf, video, etc.) */
function isNonPageUrl(url) {
  try {
    const { pathname } = new URL(url);
    const ext = path.extname(pathname).toLowerCase();
    return CONFIG.NON_PAGE_EXTENSIONS.includes(ext);
  } catch {
    return true; // unparsable URL -> skip
  }
}

/** True if the URL is on the same host as the domain being scanned. */
function isSameHost(url, domain) {
  try {
    return new URL(url).host === new URL(domain).host;
  } catch {
    return false;
  }
}

/**
 * Returns the first SKIP_URL_KEYWORDS entry found in the URL (case-insensitive),
 * or null if none match. This is the single, centralized place keyword
 * matching happens — nothing else in the script duplicates this logic.
 */
function matchedSkipKeyword(url) {
  const lowerUrl = url.toLowerCase();
  return CONFIG.SKIP_URL_KEYWORDS.find(keyword => lowerUrl.includes(keyword.toLowerCase())) || null;
}

/** Clean the raw sitemap URL list: dedupe, same-host only, pages only, keyword-filtered. */
function cleanUrlList(rawUrls, domain) {
  const deduped = Array.from(new Set(rawUrls.map(u => u.trim())));
  const filtered = [];

  for (const url of deduped) {
    if (!isSameHost(url, domain) || isNonPageUrl(url)) continue;

    const keyword = matchedSkipKeyword(url);
    if (keyword) {
      console.log(`Skipping URL (matched keyword: ${keyword})\n${url}\n`);
      continue;
    }

    filtered.push(url);
  }

  return filtered;
}

// ============================================================================
// IMAGE ALIGNMENT CHECK (runs inside the browser page context)
// ============================================================================

/**
 * Executed in-page via page.evaluate(options). For every visible <img>:
 *   1. Climbs ancestors one at a time (no fixed depth) to find the nearest
 *      ancestor that actually defines the section's horizontal content
 *      area — skipping tight wrappers that merely hug the image, and
 *      stopping based on layout characteristics (a meaningful width
 *      divergence from its own parent), not DOM depth. html/body are only
 *      used as a last-resort fallback.
 *   2. Compares the image's left/right edges against that container's
 *      left/right edges to get a left gap and right gap.
 *   3. Classifies the image as correctly aligned (ignored) or as a real
 *      layout problem (Shifted Left/Right, Overflow Left/Right/Both,
 *      Uneven Horizontal Alignment), using configurable tolerances.
 *
 * Returns { failures: [...], ignored: [...] }, each entry containing the
 * image URL/alt plus leftGap, rightGap, diff, and status.
 */
function collectAlignmentIssues(options) {
  const { alignmentTolerance, overflowTolerance, containerDivergence, tightWrapperTolerance } = options;

  function isVisible(el) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /** An ancestor whose width barely differs from the image's own width. */
  function isTightWrapper(rect, imgRect) {
    return Math.abs(rect.width - imgRect.width) <= tightWrapperTolerance;
  }

  /**
   * Walks upward from the image, one parent at a time, and returns the
   * bounding rect of the first ancestor that behaves like a real content
   * container rather than a tight wrapper or a pass-through wrapper.
   */
  function findContentContainerRect(imgEl, imgRect) {
    const candidates = [];
    let node = imgEl.parentElement;

    while (node && node !== document.documentElement) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && !isTightWrapper(rect, imgRect)) {
        candidates.push(rect);
      }
      if (node === document.body) break;
      node = node.parentElement;
    }

    if (candidates.length === 0) {
      // Nothing wider than the image was found anywhere above it —
      // fall back to body/html only as a last resort.
      return document.body.getBoundingClientRect();
    }

    // Find the point where width stops growing (or grows only slightly)
    // as we climb further — that's the ancestor that actually constrains
    // the horizontal content area for this part of the page.
    for (let i = 0; i < candidates.length; i++) {
      const current = candidates[i];
      const next = candidates[i + 1];
      if (!next || (next.width - current.width) > containerDivergence) {
        return current;
      }
    }

    return candidates[candidates.length - 1];
  }

  const failures = [];
  const ignored = [];
  const imgs = Array.from(document.querySelectorAll('img'));

  for (const img of imgs) {
    if (!isVisible(img)) continue;

    const imgRect = img.getBoundingClientRect();
    if (imgRect.width <= 0) continue;

    const containerRect = findContentContainerRect(img, imgRect);
    if (!containerRect || containerRect.width <= 0) continue;

    const round2 = n => Math.round(n * 100) / 100;
    const leftGap = round2(imgRect.left - containerRect.left);
    const rightGap = round2(containerRect.right - imgRect.right);
    const diff = round2(Math.abs(leftGap - rightGap));

    const overflowLeft = leftGap < -overflowTolerance;
    const overflowRight = rightGap < -overflowTolerance;

    let status = null; // null == correctly aligned
    if (overflowLeft && overflowRight) status = 'Overflow Both';
    else if (overflowLeft) status = 'Overflow Left';
    else if (overflowRight) status = 'Overflow Right';
    else if (diff > alignmentTolerance) status = leftGap < rightGap ? 'Shifted Left' : (rightGap < leftGap ? 'Shifted Right' : 'Uneven Horizontal Alignment');

    const record = {
      imageUrl: img.currentSrc || img.src || '',
      alt: img.getAttribute('alt') || '',
      leftGap,
      rightGap,
      diff,
      status: status || 'Aligned',
    };

    if (status) failures.push(record);
    else ignored.push(record);
  }

  return { failures, ignored };
}

// ============================================================================
// PAGE SCANNING
// ============================================================================

/**
 * Scans a single page across all configured widths and returns:
 * { errors: [...], ignored: [...] }
 * Each record: { pageUrl, imageUrl, alt, width, status, leftGap, rightGap, diff }
 */
async function scanPage(browser, pageUrl, widths) {
  const errors = [];
  const ignored = [];
  const context = await browser.newContext();
  const page = await context.newPage();

  const alignmentOptions = {
    alignmentTolerance: CONFIG.ALIGNMENT_TOLERANCE,
    overflowTolerance: CONFIG.OVERFLOW_TOLERANCE,
    containerDivergence: CONFIG.CONTAINER_WIDTH_DIVERGENCE,
    tightWrapperTolerance: CONFIG.TIGHT_WRAPPER_TOLERANCE,
  };

  try {
    // Use the widest viewport first for the initial load so lazy-loaded
    // images relevant at any breakpoint have a chance to be present.
    await page.setViewportSize({ width: widths[0], height: 900 });

    // Wait only for the DOM to be ready, not for the network to go fully
    // idle — pages with analytics, embeds, or long-running background
    // requests can otherwise hang until the timeout for no real reason.
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_TIMEOUT });

    // Brief settle so images that start loading right after DOMContentLoaded
    // (e.g. from inline scripts) have a moment to appear before we inspect.
    await page.waitForTimeout(300);

    for (const width of widths) {
      try {
        await page.setViewportSize({ width, height: 900 });
        // Give the layout a brief moment to settle after resize.
        await page.waitForTimeout(150);

        const { failures, ignored: ignoredOnWidth } = await page.evaluate(collectAlignmentIssues, alignmentOptions);

        for (const f of failures) {
          errors.push({
            pageUrl,
            imageUrl: f.imageUrl,
            alt: f.alt,
            width,
            status: f.status,
            leftGap: f.leftGap,
            rightGap: f.rightGap,
            diff: f.diff,
          });
        }

        for (const ig of ignoredOnWidth) {
          ignored.push({
            pageUrl,
            imageUrl: ig.imageUrl,
            alt: ig.alt,
            width,
            status: ig.status,
            leftGap: ig.leftGap,
            rightGap: ig.rightGap,
            diff: ig.diff,
          });
        }
      } catch (widthErr) {
        console.warn(`  [width ${width}] failed on ${pageUrl}: ${widthErr.message}`);
        // Continue with remaining widths.
      }
    }
  } catch (pageErr) {
    console.warn(`  [page] skipping ${pageUrl}: ${pageErr.message}`);
  } finally {
    await context.close();
  }

  return { errors, ignored };
}

// ============================================================================
// CONCURRENCY HELPER
// ============================================================================

/** Runs `worker` over `items` with at most `limit` concurrent tasks. */
async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const current = index++;
      try {
        const result = await worker(items[current], current);
        results.push(result);
      } catch (err) {
        console.warn(`  [task] unexpected failure on item ${current}: ${err.message}`);
      }
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, next);
  await Promise.all(runners);
  return results;
}

// ============================================================================
// REPORT WRITING
// ============================================================================

/** Identifies one logical image within a page (same URL + alt = same image). */
function imageKey(r) {
  return r.imageUrl + '||' + r.alt;
}

/** Builds the per-width detail lines for one alignment record. */
function formatAlignmentLines(rec) {
  return [
    `- Status: ${rec.status}`,
    `- Left Gap: ${rec.leftGap}px`,
    `- Right Gap: ${rec.rightGap}px`,
    `- Difference: ${rec.diff}px`,
  ];
}

/**
 * Groups a flat record list into: page -> image -> width -> alignment data.
 * Using Maps preserves first-seen order and naturally de-duplicates
 * repeated (page, image, width) combinations.
 */
function groupRecordsByPage(records) {
  const pages = new Map();

  for (const r of records) {
    if (!pages.has(r.pageUrl)) pages.set(r.pageUrl, new Map());
    const images = pages.get(r.pageUrl);

    const imgKey = imageKey(r);
    if (!images.has(imgKey)) {
      images.set(imgKey, { alt: r.alt, imageUrl: r.imageUrl, widths: new Map() });
    }
    const imageRecord = images.get(imgKey);

    if (!imageRecord.widths.has(r.width)) {
      imageRecord.widths.set(r.width, {
        status: r.status,
        leftGap: r.leftGap,
        rightGap: r.rightGap,
        diff: r.diff,
      });
    }
  }

  return pages;
}

/** Formats a single page (with all its listed images) as one text block. */
function formatPageBlock(pageUrl, images, detailsLabel) {
  const bar = '='.repeat(80);
  const imageBlocks = [];
  let index = 0;

  for (const { alt, imageUrl, widths } of images.values()) {
    index += 1;
    const heading = `Image ${index}`;

    const widthEntries = Array.from(widths.entries()).sort((a, b) => a[0] - b[0]);
    const widthBlocks = widthEntries.map(([width, rec]) => {
      const lines = formatAlignmentLines(rec);
      return `${width}px\n${lines.join('\n')}`;
    });

    const imageBlock = [
      heading,
      '-'.repeat(heading.length),
      'Alt Text:',
      alt || '(none)',
      '',
      'Image URL:',
      imageUrl,
      '',
      `${detailsLabel}:`,
      widthBlocks.join('\n\n'),
    ].join('\n');

    imageBlocks.push(imageBlock);
  }

  return [
    bar,
    'Page URL:',
    pageUrl,
    bar,
    '',
    imageBlocks.join('\n\n\n'),
    '',
    bar,
  ].join('\n');
}

/** Builds one titled report section (FAILURES or IGNORED) from a record list. */
function buildSection(title, records, detailsLabel) {
  const pages = groupRecordsByPage(records);
  if (pages.size === 0) return null;

  const sectionBar = '#'.repeat(80);
  const pageBlocks = [];
  for (const [pageUrl, images] of pages) {
    pageBlocks.push(formatPageBlock(pageUrl, images, detailsLabel));
  }

  return [sectionBar, title, sectionBar, '', pageBlocks.join('\n\n')].join('\n');
}

/** Counts unique (page, image, width) combinations in a record list. */
function countUniqueRecords(records) {
  const seen = new Set();
  for (const r of records) seen.add([r.pageUrl, r.imageUrl, r.alt, r.width].join('||'));
  return seen.size;
}

/**
 * Writes the report: a FAILURES section (real alignment problems) followed
 * by an IGNORED section (images verified as correctly aligned, kept only
 * for spot-checking — not errors). Either section is omitted if empty.
 */
function writeReport(allErrors, allIgnored, outputFile) {
  const sections = [];

  const failuresSection = buildSection('FAILED IMAGES — ALIGNMENT ISSUES', allErrors, 'Issues');
  if (failuresSection) sections.push(failuresSection);

  const ignoredSection = buildSection(
    'IGNORED IMAGES — VERIFIED ALIGNED (NOT ERRORS)',
    allIgnored,
    'Details'
  );
  if (ignoredSection) sections.push(ignoredSection);

  const body = sections.join('\n\n\n');
  fs.writeFileSync(outputFile, sections.length > 0 ? body + '\n' : '', 'utf8');

  return {
    failureCount: countUniqueRecords(allErrors),
    ignoredCount: countUniqueRecords(allIgnored),
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const { DOMAIN, SCREEN_WIDTHS, CONCURRENCY, OUTPUT_FILE } = CONFIG;

  console.log(`Scanning: ${DOMAIN}`);
  console.log(`Widths:   ${SCREEN_WIDTHS.join(', ')}`);

  // 1-4: sitemap -> URLs -> dedupe -> filter non-pages
  const rawUrls = await findAllPageUrls(DOMAIN);
  const pageUrls = cleanUrlList(rawUrls, DOMAIN);
  console.log(`Pages to scan after filtering: ${pageUrls.length}`);

  if (pageUrls.length === 0) {
    console.warn('No page URLs found. Exiting.');
    fs.writeFileSync(OUTPUT_FILE, '', 'utf8');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  let scanResults = [];
  let processed = 0;

  try {
    scanResults = await runWithConcurrency(pageUrls, CONCURRENCY, async (url) => {
      processed++;
      console.log(`[${processed}/${pageUrls.length}] Scanning ${url}`);
      const { errors, ignored } = await scanPage(browser, url, SCREEN_WIDTHS);
      if (errors.length) {
        console.log(`  -> ${errors.length} issue(s) found`);
      }
      return { errors, ignored };
    });
  } finally {
    await browser.close();
  }

  // Flatten (runWithConcurrency returns one { errors, ignored } per page)
  const flatErrors = scanResults.flatMap(r => r.errors);
  const flatIgnored = scanResults.flatMap(r => r.ignored);

  const { failureCount, ignoredCount } = writeReport(flatErrors, flatIgnored, OUTPUT_FILE);
  console.log(`\nDone. ${failureCount} alignment issue(s) and ${ignoredCount} verified-aligned image(s) written to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});