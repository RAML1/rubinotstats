/**
 * Browser-based scraper using Playwright
 *
 * SAFETY NOTES:
 * - This scraper identifies itself honestly via User-Agent
 * - Respects rate limits (minimum 2 seconds between requests)
 * - Designed for once-daily scraping only
 * - Recommend using VPN when running scraper
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { ScraperConfig, ScraperResult, PageOptions, ScraperStats } from './types';

// Honest user agent - we identify ourselves
const SCRAPER_USER_AGENT = 'RubinOTStats/1.0 (+https://rubinotstats.com; contact@rubinotstats.com)';

const DEFAULT_CONFIG: Required<ScraperConfig> = {
  headless: true,
  timeout: 60000, // 60 seconds for Cloudflare challenges
  userAgent: SCRAPER_USER_AGENT,
  delayMs: 2000, // 2 seconds between requests (polite)
  maxRetries: 2,
  persistCookies: true,
  cookieFilePath: '.scraper-data/cookies.json',
};

export class BrowserScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: Required<ScraperConfig>;
  private stats: ScraperStats;
  private lastRequestTime: number = 0;
  private isVpnWarningShown: boolean = false;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cloudflareEncounters: 0,
      cloudflareBypassSuccesses: 0,
      averageResponseTime: 0,
      sessionStartedAt: new Date(),
    };
  }

  /**
   * Show VPN warning once per session
   */
  private showVpnWarning(): void {
    if (!this.isVpnWarningShown) {
      console.log('');
      console.log('⚠️  SECURITY REMINDER ⚠️');
      console.log('Consider using a VPN when running the scraper to protect your IP.');
      console.log('Recommended: ProtonVPN (free tier) or Mullvad ($5/mo)');
      console.log('');
      this.isVpnWarningShown = true;
    }
  }

  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    this.showVpnWarning();

    console.log('Launching browser...');
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.context = await this.browser.newContext({
      userAgent: this.config.userAgent,
      viewport: { width: 1280, height: 720 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });

    console.log('Browser initialized');
    console.log(`User-Agent: ${this.config.userAgent}`);
  }

  /**
   * Check if page has Cloudflare challenge
   */
  private async hasCloudflareChallenge(page: Page): Promise<boolean> {
    try {
      const title = await page.title();
      const content = await page.content();

      return (
        title.includes('Just a moment') ||
        title.includes('Verificação') ||
        content.includes('cf-browser-verification') ||
        content.includes('challenge-platform')
      );
    } catch {
      return false;
    }
  }

  /**
   * Wait for Cloudflare challenge to complete (user may need to click checkbox)
   */
  private async waitForCloudflare(page: Page): Promise<boolean> {
    console.log('Cloudflare challenge detected. Waiting for completion...');
    console.log('If running headless, you may need to run with headless: false to click the checkbox.');
    this.stats.cloudflareEncounters++;

    try {
      // Wait up to 60 seconds for challenge to complete
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(2000);

        if (!(await this.hasCloudflareChallenge(page))) {
          console.log('Cloudflare challenge completed!');
          this.stats.cloudflareBypassSuccesses++;
          return true;
        }
      }

      console.log('Cloudflare challenge timed out after 60 seconds');
      return false;
    } catch (error) {
      console.error('Error waiting for Cloudflare:', error);
      return false;
    }
  }

  /**
   * Respect rate limits
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.config.delayMs) {
      const waitTime = this.config.delayMs - elapsed;
      console.log(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise((r) => setTimeout(r, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch a page
   */
  async fetchPage(options: PageOptions): Promise<ScraperResult> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    if (!this.browser || !this.context) {
      await this.initialize();
    }

    await this.respectRateLimit();

    const page = await this.context!.newPage();

    try {
      console.log(`Fetching: ${options.url}`);

      const response = await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout,
      });

      if (!response) {
        throw new Error('No response received');
      }

      // Handle Cloudflare
      let cloudflareEncountered = false;
      if (await this.hasCloudflareChallenge(page)) {
        cloudflareEncountered = true;
        const passed = await this.waitForCloudflare(page);
        if (!passed) {
          throw new Error('Cloudflare challenge not completed. Try running with headless: false');
        }
      }

      // Wait for content
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
      }

      const html = await page.content();
      const responseTime = Date.now() - startTime;

      this.stats.successfulRequests++;
      await page.close();

      return {
        data: html,
        success: true,
        statusCode: response.status(),
        responseTime,
        cloudflareEncountered,
      };
    } catch (error) {
      this.stats.failedRequests++;
      await page.close();

      return {
        data: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
        cloudflareEncountered: false,
      };
    }
  }

  /**
   * Get stats
   */
  getStats(): ScraperStats {
    return { ...this.stats };
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }
}

// Singleton instance
export const browserScraper = new BrowserScraper();

/**
 * Simple helper to fetch a page
 */
export async function fetchPage(url: string): Promise<string> {
  const result = await browserScraper.fetchPage({ url });
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch page');
  }
  return result.data;
}
