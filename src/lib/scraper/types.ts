/**
 * Type definitions for the RubinOT scraper module
 */

import type { Cookie } from 'playwright';

/**
 * Scraper configuration options
 */
export interface ScraperConfig {
  /** Browser headless mode (default: true) */
  headless?: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
  /** Delay between requests in milliseconds (default: 1500) */
  delayMs?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Enable cookie persistence (default: true) */
  persistCookies?: boolean;
  /** Cookie storage file path */
  cookieFilePath?: string;
}

/**
 * Browser session state
 */
export interface BrowserSession {
  /** Session ID */
  id: string;
  /** Whether browser is currently initialized */
  isInitialized: boolean;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Number of requests made in this session */
  requestCount: number;
  /** Cloudflare cookies */
  cookies?: Cookie[];
}

/**
 * Scraper result with metadata
 */
export interface ScraperResult<T = string> {
  /** Scraped data */
  data: T;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Whether Cloudflare was encountered */
  cloudflareEncountered: boolean;
  /** Cookies used for the request */
  cookies?: Cookie[];
}

/**
 * Cookie storage format
 */
export interface CookieStorage {
  /** Cookies array */
  cookies: Cookie[];
  /** Timestamp when cookies were saved */
  savedAt: Date;
  /** Domain the cookies are for */
  domain: string;
  /** Cookie expiry timestamp */
  expiresAt?: Date;
}

/**
 * Page scraping options
 */
export interface PageOptions {
  /** URL to scrape */
  url: string;
  /** Wait for specific selector before returning */
  waitForSelector?: string;
  /** Wait for network idle */
  waitForNetworkIdle?: boolean;
  /** Additional wait time in milliseconds after page load */
  additionalWaitMs?: number;
  /** Whether to take a screenshot on failure */
  screenshotOnError?: boolean;
  /** Custom cookies to use for this request */
  cookies?: Cookie[];
}

/**
 * Cloudflare challenge detection result
 */
export interface CloudflareDetection {
  /** Whether Cloudflare challenge was detected */
  detected: boolean;
  /** Type of challenge if detected */
  challengeType?: 'checkbox' | 'hcaptcha' | 'turnstile' | 'unknown';
  /** Whether challenge was successfully bypassed */
  bypassed?: boolean;
  /** Time taken to bypass in milliseconds */
  bypassTime?: number;
}

/**
 * Scraper statistics
 */
export interface ScraperStats {
  /** Total requests made */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Cloudflare challenges encountered */
  cloudflareEncounters: number;
  /** Cloudflare challenges successfully bypassed */
  cloudflareBypassSuccesses: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** Last request timestamp */
  lastRequestAt?: Date;
  /** Session start timestamp */
  sessionStartedAt: Date;
}

/**
 * Highscore entry from RubinOT
 */
export interface HighscoreEntry {
  rank: number;
  name: string;
  vocation: string;
  level: number;
  value: number; // exp or skill value
  world: string;
  category: string;
}

/**
 * Character data from individual lookup
 */
export interface CharacterData {
  name: string;
  level: number;
  vocation: string;
  world: string;
  guildName?: string;
  experience: string; // Keep as string due to large numbers
  magicLevel: number;
  fist: number;
  club: number;
  sword: number;
  axe: number;
  distance: number;
  shielding: number;
  fishing: number;
  accountStatus?: string;
  lastLogin?: string;
}

/**
 * Auction character data - the important stuff for price analysis
 */
export interface AuctionData {
  // Auction metadata
  auctionId: string;
  status: 'active' | 'finished' | 'cancelled';
  auctionStart: string;
  auctionEnd: string;
  currentBid: number;
  winningBid?: number;

  // Character basics
  name: string;
  level: number;
  vocation: string;
  world: string;
  sex: 'Male' | 'Female';

  // SKILLS - The value drivers!
  skills: {
    axeFighting: number;
    clubFighting: number;
    distanceFighting: number;
    fishing: number;
    fistFighting: number;
    magicLevel: number;
    shielding: number;
    swordFighting: number;
  };

  // Combat stats
  hitPoints: number;
  mana: number;
  capacity: number;
  speed: number;

  // Account value indicators
  experience: string;
  achievementPoints: number;
  gold: number;

  // Cosmetics & extras
  outfits: number;
  mounts: number;
  titles: number;
  blessings: number;

  // Charm system (if visible)
  charmPoints?: {
    total: number;
    spent: number;
    available: number;
  };

  // Calculated metrics for "Good Deal" analysis
  metrics?: {
    coinsPerLevel: number;
    mainSkill: string;
    mainSkillValue: number;
    isGoodDeal?: boolean;
    dealScore?: number; // 0-100 score
  };

  // Scrape metadata
  scrapedAt: string;
  sourceUrl: string;
}
