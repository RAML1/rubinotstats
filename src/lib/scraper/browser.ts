/**
 * Playwright browser manager for scraping RubinOT.
 * Uses a persistent context with anti-detection flags to bypass Cloudflare.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import * as path from 'path';
import { SCRAPER_CONFIG } from '../utils/constants';

const USER_DATA_DIR = path.join(process.cwd(), '.browser-data');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let _context: BrowserContext | null = null;

export interface BrowserOptions {
  headless?: boolean;
}

/**
 * Launch (or reuse) a persistent browser context.
 * Cloudflare cookies are stored between runs in .browser-data/.
 */
export async function getBrowserContext(
  opts: BrowserOptions = {},
): Promise<BrowserContext> {
  if (_context) return _context;

  const headless = opts.headless ?? false;

  _context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
  });

  return _context;
}

/**
 * Navigate to a URL and wait for Cloudflare to clear.
 * Returns the page once the real content has loaded.
 */
export async function navigateWithCloudflare(
  page: Page,
  url: string,
  timeoutMs = 60_000,
): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

  // Poll until Cloudflare challenge clears
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const title = await page.title();
    if (!title.toLowerCase().includes('just a moment')) return;
    await page.waitForTimeout(2000);
  }

  throw new Error(`Cloudflare challenge did not clear within ${timeoutMs}ms`);
}

/**
 * Rate-limit helper — waits the configured delay between requests.
 */
export async function rateLimit(): Promise<void> {
  await new Promise((r) => setTimeout(r, SCRAPER_CONFIG.delayMs));
}

/**
 * Close the browser context.
 */
export async function closeBrowser(): Promise<void> {
  if (_context) {
    await _context.close();
    _context = null;
  }
}
