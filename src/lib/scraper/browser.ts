/**
 * Playwright browser manager for scraping RubinOT.
 * Supports multiple named browser profiles for parallel scraping.
 * All profiles use Brave Browser (required to bypass Cloudflare).
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import * as path from 'path';
import { SCRAPER_CONFIG } from '../utils/constants';

const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Named browser profiles ─────────────────────────────────────────────

/** Profile name — each gets its own user data dir */
export type BrowserName = string;

interface BrowserInstance {
  context: BrowserContext;
  headless: boolean;
}

const _instances = new Map<BrowserName, BrowserInstance>();

export interface BrowserOptions {
  headless?: boolean;
  browser?: BrowserName;
}

/**
 * Launch (or reuse) a persistent Brave browser context.
 * Each profile gets its own user data dir (.browser-data-{name}/)
 * so cookies and sessions don't conflict between parallel scrapers.
 */
export async function getBrowserContext(
  opts: BrowserOptions = {},
): Promise<BrowserContext> {
  const name = opts.browser ?? 'default';
  const existing = _instances.get(name);
  if (existing) return existing.context;

  const headless = opts.headless ?? false;
  const userDataDir = path.join(process.cwd(), `.browser-data-${name}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    executablePath: BRAVE_PATH,
    args: ['--disable-blink-features=AutomationControlled'],
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
  });

  _instances.set(name, { context, headless });
  return context;
}

/**
 * Get a working page from a browser profile.
 * If the context is dead, relaunch it. If pages are dead, create a new one.
 */
export async function getHealthyPage(browserName: BrowserName = 'default'): Promise<Page> {
  const instance = _instances.get(browserName);

  try {
    if (instance) {
      const pages = instance.context.pages();
      if (pages.length > 0) {
        await pages[0].title(); // will throw if dead
        return pages[0];
      }
      return await instance.context.newPage();
    }
  } catch {
    console.log(`  Browser context (${browserName}) died, relaunching...`);
    _instances.delete(browserName);
  }

  const headless = instance?.headless ?? false;
  const ctx = await getBrowserContext({ headless, browser: browserName });
  await sleep(2000);
  return ctx.pages()[0] || (await ctx.newPage());
}

/**
 * Navigate to a URL and wait for Cloudflare to clear.
 * Returns the page once the real content has loaded.
 */
export async function navigateWithCloudflare(
  page: Page,
  url: string,
  timeoutMs = 15_000,
): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

  // Poll until Cloudflare challenge clears
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const title = await page.title();
      if (!title.toLowerCase().includes('just a moment')) return;
    } catch {
      // Context destroyed by navigation — use plain sleep (page may be dead)
      await sleep(1000);
      return;
    }
    await sleep(2000);
  }

  throw new Error(`Cloudflare challenge did not clear within ${timeoutMs}ms`);
}

/**
 * Rate-limit helper — waits a random delay to look human.
 * Default: 1–2s between requests. Use 'fast' for 0.5–1s (list pages),
 * 'slow' for 6–12s (after Cloudflare challenges or errors).
 */
export async function rateLimit(
  mode: 'fast' | 'normal' | 'slow' = 'normal',
): Promise<void> {
  const ranges = {
    fast: [500, 1000],
    normal: [1000, 2000],
    slow: [6000, 12000],
  };
  const [min, max] = ranges[mode];
  const delay = min + Math.floor(Math.random() * (max - min));
  await new Promise((r) => setTimeout(r, delay));
}

/**
 * Close a specific browser profile, or all if no name given.
 */
export async function closeBrowser(name?: BrowserName): Promise<void> {
  if (name) {
    const instance = _instances.get(name);
    if (instance) {
      await instance.context.close();
      _instances.delete(name);
    }
  } else {
    for (const [n, instance] of _instances) {
      await instance.context.close();
      _instances.delete(n);
    }
  }
}
