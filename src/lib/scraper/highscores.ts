/**
 * Highscores scraper for RubinOT.
 * Scrapes the leaderboard for all worlds × all categories × all pages.
 * Characters may appear across multiple categories (e.g. a knight could be
 * on the Experience, Sword Fighting, and Shielding lists). This is expected
 * and is what lets us correlate a character with their skill progression.
 */
import * as cheerio from 'cheerio';
import { RUBINOT_URLS, WORLDS, HIGHSCORE_CATEGORIES, type HighscoreCategory } from '../utils/constants';
import type { Page } from 'playwright';
import { navigateWithCloudflare, rateLimit } from './browser';

// ── Types ──────────────────────────────────────────────────────────────

export interface ScrapedHighscoreEntry {
  rank: number;
  characterName: string;
  vocation: string;
  world: string;
  level: number;
  score: bigint;
  category: string;
}

export interface HighscorePageResult {
  entries: ScrapedHighscoreEntry[];
  totalPages: number;
  totalResults: number;
}

export interface ScrapeHighscoresOptions {
  worlds?: string[];
  categories?: HighscoreCategory[];
  maxPages?: number;
  onEntry?: (entry: ScrapedHighscoreEntry) => Promise<void>;
  onPageDone?: (world: string, category: string, page: number, totalPages: number, count: number) => void;
}

// ── Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a highscores HTML page into structured entries.
 */
export function parseHighscorePage(html: string, category: string): HighscorePageResult {
  const $ = cheerio.load(html);
  const entries: ScrapedHighscoreEntry[] = [];

  // Parse data rows from table — rows with bgcolor are data rows
  $('table.TableContent tr[bgcolor]').each((_i, el) => {
    const tds = $(el).find('td');
    if (tds.length < 6) return;

    const rank = parseInt($(tds[0]).text().trim(), 10);
    const characterName = $(tds[1]).find('a').text().trim() || $(tds[1]).text().trim();
    const vocation = $(tds[2]).text().trim();
    const world = $(tds[3]).text().trim();
    const level = parseInt($(tds[4]).text().trim(), 10);
    const scoreText = $(tds[5]).text().trim().replace(/[^0-9]/g, '');
    const score = scoreText ? BigInt(scoreText) : BigInt(0);

    if (!characterName || isNaN(rank)) return;

    entries.push({
      rank,
      characterName,
      vocation,
      world,
      level: isNaN(level) ? 0 : level,
      score,
      category,
    });
  });

  // Parse pagination — find the highest page number
  let totalPages = 1;
  $('span.PageLink a, span.CurrentPageLink').each((_i, el) => {
    const pageNum = parseInt($(el).text().trim(), 10);
    if (!isNaN(pageNum) && pageNum > totalPages) totalPages = pageNum;
  });

  // Parse total results from "Results: X"
  let totalResults = entries.length;
  const resultsText = $('td.PageNavigation').first().text();
  const resultsMatch = resultsText.match(/Results:\s*(\d+)/);
  if (resultsMatch) {
    totalResults = parseInt(resultsMatch[1], 10);
  }

  return { entries, totalPages, totalResults };
}

// ── URL builder ────────────────────────────────────────────────────────

function buildHighscoreUrl(world: string, categoryValue: string, page: number): string {
  const params = new URLSearchParams({
    subtopic: 'highscores',
    world,
    beprotection: '-1',
    category: categoryValue,
    profession: '',
    currentpage: page.toString(),
  });
  return `${RUBINOT_URLS.base}/?${params.toString()}`;
}

// ── Full scraper ───────────────────────────────────────────────────────

/**
 * Scrape highscores for specified worlds and categories.
 * Iterates world × category × page, parsing each page with Cheerio.
 */
export async function scrapeHighscores(
  page: Page,
  opts: ScrapeHighscoresOptions = {},
): Promise<ScrapedHighscoreEntry[]> {
  const worlds = opts.worlds ?? [...WORLDS];
  const categories = opts.categories ?? (Object.keys(HIGHSCORE_CATEGORIES) as HighscoreCategory[]);
  const allEntries: ScrapedHighscoreEntry[] = [];

  const totalCombinations = worlds.length * categories.length;
  let completedCombinations = 0;

  for (const world of worlds) {
    for (const category of categories) {
      completedCombinations++;
      const categoryValue = HIGHSCORE_CATEGORIES[category];

      // Fetch page 1 to get total pages
      const firstUrl = buildHighscoreUrl(world, categoryValue, 1);
      console.log(`\n[${completedCombinations}/${totalCombinations}] ${world} / ${category}`);
      console.log(`  Fetching page 1: ${firstUrl}`);

      await rateLimit();
      await navigateWithCloudflare(page, firstUrl);
      await page.waitForTimeout(800 + Math.floor(Math.random() * 1200));

      const firstHtml = await page.content();
      const firstResult = parseHighscorePage(firstHtml, category);

      const maxPages = opts.maxPages
        ? Math.min(firstResult.totalPages, opts.maxPages)
        : firstResult.totalPages;

      console.log(`  ${firstResult.totalResults} results, ${firstResult.totalPages} pages (scraping ${maxPages})`);

      // Process page 1 entries
      for (const entry of firstResult.entries) {
        if (opts.onEntry) await opts.onEntry(entry);
        allEntries.push(entry);
      }
      opts.onPageDone?.(world, category, 1, maxPages, firstResult.entries.length);

      // Process remaining pages
      for (let p = 2; p <= maxPages; p++) {
        await rateLimit();
        const pageUrl = buildHighscoreUrl(world, categoryValue, p);

        try {
          await navigateWithCloudflare(page, pageUrl);
          await page.waitForTimeout(800 + Math.floor(Math.random() * 1200));

          const html = await page.content();
          const result = parseHighscorePage(html, category);

          for (const entry of result.entries) {
            if (opts.onEntry) await opts.onEntry(entry);
            allEntries.push(entry);
          }
          opts.onPageDone?.(world, category, p, maxPages, result.entries.length);
        } catch (err) {
          console.error(`  Failed page ${p} for ${world}/${category}:`, err);
        }
      }
    }
  }

  return allEntries;
}
