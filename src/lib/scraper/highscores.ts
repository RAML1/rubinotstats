/**
 * Experience Points highscores scraper for RubinOT.
 * Scrapes the leaderboard for all worlds × all vocations (experience only).
 * Strategy: 20 tabs blast all pages of one combo simultaneously, then move to next.
 */
import * as cheerio from 'cheerio';
import {
  RUBINOT_URLS,
  WORLDS,
  HIGHSCORE_CATEGORIES,
  HIGHSCORE_PROFESSIONS,
  type HighscoreProfession,
} from '../utils/constants';
import type { Page, BrowserContext } from 'playwright';
import { navigateWithCloudflare, rateLimit, getHealthyPage, getBrowserContext, closeBrowser, sleep } from './browser';
import type { BrowserName } from './browser';

// ── Types ──────────────────────────────────────────────────────────────

export interface ScrapedHighscoreEntry {
  rank: number;
  characterName: string;
  vocation: string;
  world: string;
  level: number;
  score: bigint;
  category: string;
  profession: string;
}

export interface HighscorePageResult {
  entries: ScrapedHighscoreEntry[];
  totalPages: number;
  totalResults: number;
}

export interface ScrapeHighscoresOptions {
  worlds?: string[];
  professions?: HighscoreProfession[];
  maxPages?: number;
  headless?: boolean;
  browser?: BrowserName;
  onEntry?: (entry: ScrapedHighscoreEntry) => Promise<void>;
  onPageDone?: (world: string, profession: string, page: number, totalPages: number, count: number) => void;
  onComboDone?: (comboKey: string) => void;
  completedCombos?: Set<string>;
}

// ── Combo key ─────────────────────────────────────────────────────────

export function comboKey(world: string, profession: string): string {
  return `${world}|${profession}`;
}

// ── Parser ─────────────────────────────────────────────────────────────

const CATEGORY = 'Experience Points';

export function parseHighscorePage(html: string, profession: string): HighscorePageResult {
  const $ = cheerio.load(html);
  const entries: ScrapedHighscoreEntry[] = [];

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
      category: CATEGORY,
      profession,
    });
  });

  let totalPages = 1;
  $('span.PageLink a, span.CurrentPageLink').each((_i, el) => {
    const pageNum = parseInt($(el).text().trim(), 10);
    if (!isNaN(pageNum) && pageNum > totalPages) totalPages = pageNum;
  });

  let totalResults = entries.length;
  const resultsText = $('td.PageNavigation').first().text();
  const resultsMatch = resultsText.match(/Results:\s*(\d+)/);
  if (resultsMatch) {
    totalResults = parseInt(resultsMatch[1], 10);
  }

  return { entries, totalPages, totalResults };
}

// ── URL builder ────────────────────────────────────────────────────────

const EXP_CATEGORY_VALUE = HIGHSCORE_CATEGORIES['Experience Points'];

function buildHighscoreUrl(world: string, professionValue: string, page: number): string {
  const params = new URLSearchParams({
    subtopic: 'highscores',
    world,
    beprotection: '-1',
    category: EXP_CATEGORY_VALUE,
    profession: professionValue,
    currentpage: page.toString(),
  });
  return `${RUBINOT_URLS.base}/?${params.toString()}`;
}

// ── Blast scraper: 20 tabs per combo ──────────────────────────────────

const TAB_COUNT = 20;

export async function scrapeHighscores(
  context: BrowserContext,
  opts: ScrapeHighscoresOptions = {},
): Promise<ScrapedHighscoreEntry[]> {
  const worlds = opts.worlds ?? [...WORLDS];
  const professions = opts.professions ?? ['Knights', 'Paladins', 'Sorcerers', 'Druids', 'Monks'] as HighscoreProfession[];
  const completed = opts.completedCombos ?? new Set<string>();
  const allEntries: ScrapedHighscoreEntry[] = [];
  const browserName = opts.browser ?? 'highscores';
  const headless = opts.headless ?? false;

  let ctx = context;

  // Build combo queue (skip completed)
  const queue: { world: string; profession: HighscoreProfession }[] = [];
  for (const world of worlds) {
    for (const profession of professions) {
      if (!completed.has(comboKey(world, profession))) {
        queue.push({ world, profession });
      }
    }
  }

  const totalCombinations = worlds.length * professions.length;
  const alreadyDone = totalCombinations - queue.length;
  console.log(`  Total combos: ${totalCombinations} (${TAB_COUNT} tabs per combo)`);
  if (alreadyDone > 0) {
    console.log(`  Resuming: ${alreadyDone} already done, ${queue.length} remaining`);
  }

  // Build tab pool
  const tabs: Page[] = [];
  const existingPages = ctx.pages();
  for (let i = 0; i < TAB_COUNT; i++) {
    tabs.push(existingPages[i] || (await ctx.newPage()));
  }

  async function rebuildTabs(): Promise<void> {
    const newPages = ctx.pages();
    for (let t = 0; t < TAB_COUNT; t++) {
      tabs[t] = newPages[t] || (await ctx.newPage());
    }
  }

  async function restartBrowser(cooldownSec: number): Promise<void> {
    console.log(`  Restarting browser (${cooldownSec}s cooldown)...`);
    await sleep(cooldownSec * 1000);
    try { await closeBrowser(browserName); } catch {}
    ctx = await getBrowserContext({ headless, browser: browserName });
    await rebuildTabs();
    console.log(`  Browser restarted`);
  }

  let completedCount = alreadyDone;

  for (const { world, profession } of queue) {
    const key = comboKey(world, profession);
    const professionValue = HIGHSCORE_PROFESSIONS[profession];
    completedCount++;

    console.log(`\n[${completedCount}/${totalCombinations}] ${world} / ${profession}`);

    // Step 1: Load page 1 to discover totalPages
    let firstResult: HighscorePageResult | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await rateLimit();
        await navigateWithCloudflare(tabs[0], buildHighscoreUrl(world, professionValue, 1), attempt > 1 ? 30_000 : 15_000);
        await sleep(300 + Math.floor(Math.random() * 500));
        const html = await tabs[0].content();
        firstResult = parseHighscorePage(html, profession);
        break;
      } catch (err) {
        console.error(`  Page 1 failed (attempt ${attempt}/3): ${(err as Error).message?.substring(0, 60)}`);
        if (attempt < 3) {
          const cooldown = attempt === 1 ? 20 + Math.floor(Math.random() * 20) : 60 + Math.floor(Math.random() * 60);
          if (attempt >= 2) await restartBrowser(cooldown);
          else await sleep(cooldown * 1000);
        }
      }
    }

    if (!firstResult) {
      console.error(`  All attempts failed — skipping ${world}/${profession}`);
      continue;
    }

    const maxPages = opts.maxPages
      ? Math.min(firstResult.totalPages, opts.maxPages)
      : firstResult.totalPages;

    console.log(`  ${firstResult.totalResults} results, ${maxPages} pages — blasting all at once`);

    if (firstResult.entries.length === 0) {
      opts.onComboDone?.(key);
      continue;
    }

    // Process page 1 entries
    for (const entry of firstResult.entries) {
      if (opts.onEntry) await opts.onEntry(entry);
      allEntries.push(entry);
    }
    opts.onPageDone?.(world, profession, 1, maxPages, firstResult.entries.length);

    if (maxPages <= 1) {
      opts.onComboDone?.(key);
      continue;
    }

    // Step 2: Blast remaining pages (2..maxPages) across all tabs
    const remainingPages = Array.from({ length: maxPages - 1 }, (_, i) => i + 2);
    let pageQueue = [...remainingPages];
    let pageIdx = 0;
    let failedPages: number[] = [];

    // Scrape a batch of pages in parallel
    async function blastPages(pages: number[], cfTimeout: number): Promise<{ succeeded: number[]; failed: number[] }> {
      const succeeded: number[] = [];
      const failed: number[] = [];

      // Assign pages to tabs (up to TAB_COUNT at a time)
      const batches: number[][] = [];
      for (let i = 0; i < pages.length; i += TAB_COUNT) {
        batches.push(pages.slice(i, i + TAB_COUNT));
      }

      for (const batch of batches) {
        // Stagger launches within a batch
        const promises = batch.map(async (pageNum, tabIdx) => {
          await sleep(tabIdx * 500); // 0.5s stagger between tabs
          const tab = tabs[tabIdx];
          const url = buildHighscoreUrl(world, professionValue, pageNum);

          try {
            await navigateWithCloudflare(tab, url, cfTimeout);
            await sleep(200 + Math.floor(Math.random() * 300));
            const html = await tab.content();
            const result = parseHighscorePage(html, profession);

            for (const entry of result.entries) {
              if (opts.onEntry) await opts.onEntry(entry);
              allEntries.push(entry);
            }
            opts.onPageDone?.(world, profession, pageNum, maxPages, result.entries.length);
            succeeded.push(pageNum);
          } catch {
            failed.push(pageNum);
          }
        });

        await Promise.all(promises);

        // If any failed in this batch, stop blasting (Cloudflare is hot)
        if (failed.length > 0) break;

        // Brief pause between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await sleep(1000 + Math.floor(Math.random() * 1000));
        }
      }

      return { succeeded, failed };
    }

    // First blast: try all remaining pages
    const result1 = await blastPages(remainingPages, 15_000);
    console.log(`  Blast: ${result1.succeeded.length} pages OK, ${result1.failed.length} failed`);

    // If some pages failed, restart browser and retry just those
    if (result1.failed.length > 0) {
      const cooldown = 60 + Math.floor(Math.random() * 60);
      await restartBrowser(cooldown);

      const result2 = await blastPages(result1.failed, 30_000);
      console.log(`  Retry: ${result2.succeeded.length} pages OK, ${result2.failed.length} still failed`);

      if (result2.failed.length > 0) {
        console.log(`  ${result2.failed.length} pages could not be scraped: [${result2.failed.join(', ')}]`);
        // Still mark combo as done — we got most of the data
      }
    }

    opts.onComboDone?.(key);

    // Brief cooldown between combos to keep Cloudflare happy
    await sleep(2000 + Math.floor(Math.random() * 3000));
  }

  return allEntries;
}
