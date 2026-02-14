/**
 * Highscores scraper for RubinOT.
 * Scrapes the leaderboard for all worlds × all categories × all professions × all pages.
 * Characters may appear across multiple categories (e.g. a knight could be
 * on the Experience, Sword Fighting, and Shielding lists). This is expected
 * and is what lets us correlate a character with their skill progression.
 */
import * as cheerio from 'cheerio';
import {
  RUBINOT_URLS,
  WORLDS,
  HIGHSCORE_CATEGORIES,
  HIGHSCORE_PROFESSIONS,
  DAILY_CATEGORIES,
  DAILY_PROFESSIONS,
  PROFESSION_SKIP_CATEGORIES,
  type HighscoreCategory,
  type HighscoreProfession,
} from '../utils/constants';
import type { Page } from 'playwright';
import { navigateWithCloudflare, rateLimit, getHealthyPage } from './browser';

// ── Types ──────────────────────────────────────────────────────────────

export interface ScrapedHighscoreEntry {
  rank: number;
  characterName: string;
  vocation: string;
  world: string;
  level: number;
  score: bigint;
  category: string;
  profession: string; // The profession filter used (e.g. "Knights", "All")
}

export interface HighscorePageResult {
  entries: ScrapedHighscoreEntry[];
  totalPages: number;
  totalResults: number;
}

export interface ScrapeHighscoresOptions {
  worlds?: string[];
  categories?: HighscoreCategory[];
  professions?: HighscoreProfession[];
  maxPages?: number;
  onEntry?: (entry: ScrapedHighscoreEntry) => Promise<void>;
  onPageDone?: (world: string, category: string, profession: string, page: number, totalPages: number, count: number) => void;
  onComboDone?: (comboKey: string) => void;
  completedCombos?: Set<string>;
}

// ── Combo key ─────────────────────────────────────────────────────────

export function comboKey(world: string, category: string, profession: string): string {
  return `${world}|${category}|${profession}`;
}

// ── Should-skip logic ─────────────────────────────────────────────────

export function shouldSkipCombo(category: HighscoreCategory, profession: HighscoreProfession): boolean {
  const skipList = PROFESSION_SKIP_CATEGORIES[profession];
  if (!skipList) return false;
  return skipList.includes(category);
}

// ── Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a highscores HTML page into structured entries.
 */
export function parseHighscorePage(html: string, category: string, profession: string): HighscorePageResult {
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
      profession,
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

function buildHighscoreUrl(world: string, categoryValue: string, professionValue: string, page: number): string {
  const params = new URLSearchParams({
    subtopic: 'highscores',
    world,
    beprotection: '-1',
    category: categoryValue,
    profession: professionValue,
    currentpage: page.toString(),
  });
  return `${RUBINOT_URLS.base}/?${params.toString()}`;
}

// ── Full scraper ───────────────────────────────────────────────────────

/**
 * Scrape highscores for specified worlds, categories, and professions.
 * Iterates world × category × profession × page, parsing each page with Cheerio.
 * Supports resume via completedCombos set and skip rules per vocation.
 */
export async function scrapeHighscores(
  page: Page,
  opts: ScrapeHighscoresOptions = {},
): Promise<ScrapedHighscoreEntry[]> {
  const worlds = opts.worlds ?? [...WORLDS];
  const categories = opts.categories ?? DAILY_CATEGORIES;
  const professions = opts.professions ?? DAILY_PROFESSIONS;
  const completed = opts.completedCombos ?? new Set<string>();
  const allEntries: ScrapedHighscoreEntry[] = [];

  // Mutable page ref — may be replaced if browser context dies
  let currentPage = page;

  // Build full combo list and count relevant ones
  let totalCombinations = 0;
  let skippedIrrelevant = 0;
  let skippedResume = 0;
  for (const _w of worlds) {
    for (const cat of categories) {
      for (const prof of professions) {
        if (shouldSkipCombo(cat, prof)) {
          skippedIrrelevant++;
        } else {
          totalCombinations++;
        }
      }
    }
  }

  // Count already-completed from resume
  for (const _w of worlds) {
    for (const cat of categories) {
      for (const prof of professions) {
        if (!shouldSkipCombo(cat, prof) && completed.has(comboKey(_w, cat, prof))) {
          skippedResume++;
        }
      }
    }
  }

  const remaining = totalCombinations - skippedResume;
  console.log(`  Relevant combos: ${totalCombinations} (skipped ${skippedIrrelevant} irrelevant)`);
  if (skippedResume > 0) {
    console.log(`  Resuming: ${skippedResume} already done, ${remaining} remaining`);
  }

  let completedCount = skippedResume;

  for (const world of worlds) {
    for (const category of categories) {
      const categoryValue = HIGHSCORE_CATEGORIES[category];

      for (const profession of professions) {
        // Skip irrelevant vocation/category combos
        if (shouldSkipCombo(category, profession)) continue;

        const key = comboKey(world, category, profession);

        // Skip already-completed combos (resume)
        if (completed.has(key)) continue;

        completedCount++;
        const professionValue = HIGHSCORE_PROFESSIONS[profession];

        // Fetch page 1 to get total pages
        const firstUrl = buildHighscoreUrl(world, categoryValue, professionValue, 1);
        console.log(`\n[${completedCount}/${totalCombinations}] ${world} / ${category} / ${profession}`);

        let firstResult: HighscorePageResult;
        try {
          await rateLimit();
          await navigateWithCloudflare(currentPage, firstUrl);
          await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 500)));

          const firstHtml = await currentPage.content();
          firstResult = parseHighscorePage(firstHtml, category, profession);
        } catch (err) {
          // Page/browser context died — wait for Cloudflare cooldown, then retry
          let recovered = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            const cooldown = attempt * 30; // 30s, 60s, 90s
            console.error(`  Page died — waiting ${cooldown}s before retry ${attempt}/3...`);
            await new Promise((r) => setTimeout(r, cooldown * 1000));
            try {
              currentPage = await getHealthyPage();
              await navigateWithCloudflare(currentPage, firstUrl);
              await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 500)));

              const firstHtml = await currentPage.content();
              firstResult = parseHighscorePage(firstHtml, category, profession);
              recovered = true;
              console.log(`  Recovered on attempt ${attempt}`);
              break;
            } catch {
              // Try again with longer cooldown
            }
          }
          if (!recovered) {
            console.error(`  All recovery attempts failed — skipping combo`);
            continue;
          }
        }

        const maxPages = opts.maxPages
          ? Math.min(firstResult.totalPages, opts.maxPages)
          : firstResult.totalPages;

        console.log(`  ${firstResult.totalResults} results, ${firstResult.totalPages} pages (scraping ${maxPages})`);

        // Skip empty combos
        if (firstResult.entries.length === 0) {
          console.log('  No entries, skipping');
          opts.onComboDone?.(key);
          continue;
        }

        // Process page 1 entries
        for (const entry of firstResult.entries) {
          if (opts.onEntry) await opts.onEntry(entry);
          allEntries.push(entry);
        }
        opts.onPageDone?.(world, category, profession, 1, maxPages, firstResult.entries.length);

        // Process remaining pages
        for (let p = 2; p <= maxPages; p++) {
          await rateLimit('fast');
          const pageUrl = buildHighscoreUrl(world, categoryValue, professionValue, p);

          try {
            await navigateWithCloudflare(currentPage, pageUrl);
            await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 500)));

            const html = await currentPage.content();
            const result = parseHighscorePage(html, category, profession);

            for (const entry of result.entries) {
              if (opts.onEntry) await opts.onEntry(entry);
              allEntries.push(entry);
            }
            opts.onPageDone?.(world, category, profession, p, maxPages, result.entries.length);
          } catch (err) {
            console.error(`  Cloudflare blocked page ${p} for ${world}/${category}/${profession} — skipping rest of combo`);
            // Wait 30s and recover page for the next combo
            console.error(`  Cooling down 30s before next combo...`);
            await new Promise((r) => setTimeout(r, 30_000));
            try {
              currentPage = await getHealthyPage();
            } catch {
              // Will be recovered on next combo's first fetch
            }
            break;
          }
        }

        // Mark combo as done
        opts.onComboDone?.(key);
      }
    }
  }

  return allEntries;
}
