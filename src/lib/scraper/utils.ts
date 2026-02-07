/**
 * Utility functions for web scraping RubinOT
 */

import { load } from 'cheerio';
import { browserScraper } from './browser';
import { RUBINOT_URLS } from '@/lib/utils/constants';
import type { ScraperResult } from './types';

/**
 * Fetch and parse HTML from a URL
 */
export async function fetchAndParse(url: string) {
  const result = await browserScraper.fetchPage({ url });

  if (!result.success) {
    throw new Error(`Failed to fetch ${url}: ${result.error}`);
  }

  return load(result.data);
}

/**
 * Fetch RubinOT highscores page
 */
export async function fetchHighscores(world?: string, category?: string): Promise<string> {
  let url = `${RUBINOT_URLS.base}${RUBINOT_URLS.highscores}`;

  const params = new URLSearchParams();
  if (world) params.append('world', world);
  if (category) params.append('list', category);

  if (params.toString()) {
    url += `&${params.toString()}`;
  }

  const result = await browserScraper.fetchPage({
    url,
    waitForNetworkIdle: true,
    additionalWaitMs: 1000,
  });

  if (!result.success) {
    throw new Error(`Failed to fetch highscores: ${result.error}`);
  }

  return result.data;
}

/**
 * Fetch RubinOT character page
 */
export async function fetchCharacter(characterName: string): Promise<string> {
  const url = `${RUBINOT_URLS.base}${RUBINOT_URLS.characters}&name=${encodeURIComponent(characterName)}`;

  const result = await browserScraper.fetchPage({
    url,
    waitForNetworkIdle: true,
  });

  if (!result.success) {
    throw new Error(`Failed to fetch character ${characterName}: ${result.error}`);
  }

  return result.data;
}

/**
 * Fetch current character auctions/trades
 */
export async function fetchCurrentAuctions(): Promise<string> {
  const url = `${RUBINOT_URLS.base}${RUBINOT_URLS.currentAuctions}`;

  const result = await browserScraper.fetchPage({
    url,
    waitForNetworkIdle: true,
    additionalWaitMs: 2000, // Give extra time for auction data to load
  });

  if (!result.success) {
    throw new Error(`Failed to fetch current auctions: ${result.error}`);
  }

  return result.data;
}

/**
 * Fetch past character auctions/trades
 */
export async function fetchPastAuctions(): Promise<string> {
  const url = `${RUBINOT_URLS.base}${RUBINOT_URLS.pastAuctions}`;

  const result = await browserScraper.fetchPage({
    url,
    waitForNetworkIdle: true,
    additionalWaitMs: 2000,
  });

  if (!result.success) {
    throw new Error(`Failed to fetch past auctions: ${result.error}`);
  }

  return result.data;
}

/**
 * Fetch worlds information
 */
export async function fetchWorlds(): Promise<string> {
  const url = `${RUBINOT_URLS.base}${RUBINOT_URLS.worlds}`;

  const result = await browserScraper.fetchPage({
    url,
    waitForNetworkIdle: true,
  });

  if (!result.success) {
    throw new Error(`Failed to fetch worlds: ${result.error}`);
  }

  return result.data;
}

/**
 * Parse highscore data from HTML
 */
export function parseHighscores(html: string) {
  const $ = load(html);
  const entries: Array<{
    rank: number;
    name: string;
    vocation: string;
    world: string;
    level: number;
    points: number;
  }> = [];

  // This is a placeholder - you'll need to adjust selectors based on actual HTML structure
  $('table.highscores tr').each((index, element) => {
    if (index === 0) return; // Skip header row

    const $row = $(element);
    const cells = $row.find('td');

    if (cells.length >= 5) {
      entries.push({
        rank: parseInt(cells.eq(0).text().trim()) || 0,
        name: cells.eq(1).text().trim(),
        vocation: cells.eq(2).text().trim(),
        world: cells.eq(3).text().trim(),
        level: parseInt(cells.eq(4).text().trim()) || 0,
        points: parseInt(cells.eq(5).text().trim().replace(/\D/g, '')) || 0,
      });
    }
  });

  return entries;
}

/**
 * Parse character data from HTML
 */
export function parseCharacter(html: string) {
  const $ = load(html);

  // This is a placeholder - adjust selectors based on actual HTML structure
  return {
    name: $('h1.character-name').text().trim(),
    level: parseInt($('.character-level').text().trim()) || 0,
    vocation: $('.character-vocation').text().trim(),
    world: $('.character-world').text().trim(),
    // Add more fields as needed
  };
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Extract numbers from text
 */
export function extractNumber(text: string): number {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Clean text by removing extra whitespace and newlines
 */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parse skill value from text (handles formats like "100/85")
 */
export function parseSkillValue(text: string): number {
  const cleaned = cleanText(text);
  const match = cleaned.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Check if scraper is healthy (browser initialized and working)
 */
export async function checkScraperHealth(): Promise<{
  healthy: boolean;
  message: string;
  stats?: any;
}> {
  try {
    await browserScraper.initialize();

    const stats = browserScraper.getStats();

    return {
      healthy: true,
      message: 'Scraper is healthy and ready',
      stats,
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully shutdown the scraper
 */
export async function shutdownScraper(): Promise<void> {
  console.log('Shutting down scraper...');
  await browserScraper.close();
  console.log('Scraper shutdown complete');
}
