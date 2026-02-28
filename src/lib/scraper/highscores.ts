/**
 * Highscores scraper for RubinOT.
 * Uses the JSON API at /api/highscores — supports experience + all skill categories.
 * Returns up to 1,000 entries per world×category in one request.
 * NOTE: The API ignores the vocation filter — always returns top 1,000 across all vocations.
 * Still needs Brave Browser to bypass Cloudflare on the first request.
 */
import {
  RUBINOT_URLS,
  WORLDS,
  HIGHSCORE_PROFESSIONS,
  HIGHSCORE_CATEGORIES,
  DAILY_CATEGORIES,
  type HighscoreProfession,
  type HighscoreCategory,
} from '../utils/constants';
import type { Page, BrowserContext } from 'playwright';
import { navigateWithCloudflare, rateLimit, getBrowserContext, closeBrowser, sleep } from './browser';
import type { BrowserName } from './browser';

/**
 * Map our category names to the API `category` query parameter value.
 * Tested empirically — the API accepts these exact param values.
 * Categories not listed here are not yet supported by the API.
 */
const API_CATEGORY_PARAM: Record<string, string> = {
  'Experience Points': 'experience',
  'Magic Level': 'magic',
  'Fist Fighting': 'fist',
  'Club Fighting': 'club',
  'Sword Fighting': 'sword',
  'Axe Fighting': 'axe',
  'Distance Fighting': 'distance',
  'Shielding': 'shielding',
  'Fishing': 'fishing',
};

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

export interface ScrapeHighscoresOptions {
  worlds?: string[];
  professions?: HighscoreProfession[];
  categories?: HighscoreCategory[];
  maxPages?: number; // kept for CLI compat but ignored (API returns all at once)
  headless?: boolean;
  browser?: BrowserName;
  onEntry?: (entry: ScrapedHighscoreEntry) => Promise<void>;
  onPageDone?: (world: string, profession: string, page: number, totalPages: number, count: number) => void | Promise<void>;
  onComboDone?: (comboKey: string) => void;
  completedCombos?: Set<string>;
}

// ── Combo key ─────────────────────────────────────────────────────────

export function comboKey(world: string, profession: string, category?: string): string {
  if (category) return `${world}|${profession}|${category}`;
  return `${world}|${profession}`;
}

/** Map numeric vocation IDs from API to vocation names */
const VOCATION_ID_TO_NAME: Record<number, string> = {
  0: 'None',
  1: 'Knight',
  2: 'Elite Knight',
  3: 'Paladin',
  4: 'Royal Paladin',
  5: 'Sorcerer',
  6: 'Master Sorcerer',
  7: 'Druid',
  8: 'Elder Druid',
  9: 'Monk',
  10: 'None',
};

/** Map vocation names to the profession group they belong to */
const VOCATION_TO_PROFESSION: Record<string, string> = {
  'Knight': 'Knights',
  'Elite Knight': 'Knights',
  'Paladin': 'Paladins',
  'Royal Paladin': 'Paladins',
  'Sorcerer': 'Sorcerers',
  'Master Sorcerer': 'Sorcerers',
  'Druid': 'Druids',
  'Elder Druid': 'Druids',
  'Monk': 'Monks',
  'None': 'All',
};

// ── Categories that need HTML scraping (not supported by API) ─────

const HTML_ONLY_CATEGORIES = new Set(['Charm Points']);

// ── World ID cache (fetched from /api/worlds) ─────────────────────────

let worldIdMap: Map<string, number> | null = null;

async function fetchWorldIds(page: Page): Promise<Map<string, number>> {
  if (worldIdMap) return worldIdMap;

  const data = await page.evaluate(async () => {
    const res = await fetch('/api/worlds');
    if (!res.ok) throw new Error(`Worlds API ${res.status}`);
    return res.json();
  });

  worldIdMap = new Map<string, number>();
  for (const w of data.worlds ?? data) {
    worldIdMap.set(w.name, w.id);
  }
  console.log(`  Loaded ${worldIdMap.size} worlds from API`);
  return worldIdMap;
}

// ── API fetcher ─────────────────────────────────────────────────────────

interface ApiHighscorePlayer {
  rank: number;
  id: number;
  name: string;
  level: number;
  vocation: number | string;
  world_id: number;
  value: number;
}

interface ApiHighscoreResponse {
  players: ApiHighscorePlayer[];
  totalCount: number;
  cachedAt: string;
}

async function fetchHighscoresFromApi(
  page: Page,
  worldId: number | '',
  categoryParam: string = 'experience',
): Promise<ApiHighscoreResponse> {
  const url = `/api/highscores?world=${worldId}&category=${categoryParam}&vocation=all&page=1`;

  return page.evaluate(async (apiUrl: string) => {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Highscores API ${res.status}: ${res.statusText}`);
    return res.json();
  }, url);
}

// ── HTML fallback scraper (for categories not in API) ───────────────────

interface HtmlHighscoreRow {
  rank: number;
  name: string;
  vocation: string;
  level: number;
  score: number;
}

async function scrapeHighscoresFromHtml(
  page: Page,
  worldName: string,
  categoryFormValue: string,
): Promise<HtmlHighscoreRow[]> {
  // Navigate to highscores page
  await navigateWithCloudflare(page, `${RUBINOT_URLS.base}/highscores`, 60_000);
  await sleep(2000);

  // Fill and submit the highscores form via page.evaluate
  const rows = await page.evaluate(
    async ({ worldName: wName, categoryValue }: { worldName: string; categoryValue: string }) => {
      // Select the world in the dropdown
      const worldSelect = document.querySelector<HTMLSelectElement>('select[name="world"]');
      if (worldSelect) {
        const worldOption = Array.from(worldSelect.options).find(
          (o) => o.text.trim() === wName
        );
        if (worldOption) worldSelect.value = worldOption.value;
      }

      // Select the category
      const catSelect = document.querySelector<HTMLSelectElement>('select[name="category"]');
      if (catSelect) catSelect.value = categoryValue;

      // Submit the form
      const form = worldSelect?.closest('form') || document.querySelector('form');
      if (form) {
        const formData = new FormData(form);
        const params = new URLSearchParams();
        formData.forEach((v, k) => params.append(k, String(v)));

        const res = await fetch(form.action || '/highscores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        const html = await res.text();

        // Parse the response HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Find the highscores table — look for the table with rank/name/score columns
        const tables = doc.querySelectorAll('table');
        const results: Array<{ rank: number; name: string; vocation: string; level: number; score: number }> = [];

        for (const table of tables) {
          const headerRow = table.querySelector('tr');
          if (!headerRow) continue;
          const headers = Array.from(headerRow.querySelectorAll('th, td')).map(
            (h) => h.textContent?.trim().toLowerCase() || ''
          );
          // Look for a table with typical highscore columns
          if (!headers.some((h) => h.includes('rank') || h === '#')) continue;

          const dataRows = table.querySelectorAll('tr');
          for (let i = 1; i < dataRows.length; i++) {
            const cells = dataRows[i].querySelectorAll('td');
            if (cells.length < 4) continue;

            const rank = parseInt(cells[0]?.textContent?.trim() || '0', 10);
            const name = cells[1]?.textContent?.trim() || '';
            // Vocation + level are usually in cell 2 or separate cells
            // Format varies: "Elite Knight - Level 500" or separate columns
            let vocation = '';
            let level = 0;
            let score = 0;

            if (cells.length >= 5) {
              // Separate columns: Rank | Name | Vocation | Level | Score
              vocation = cells[2]?.textContent?.trim() || '';
              level = parseInt(cells[3]?.textContent?.trim() || '0', 10);
              score = parseInt(cells[4]?.textContent?.trim().replace(/[.,\s]/g, '') || '0', 10);
            } else if (cells.length === 4) {
              // Compact: Rank | Name | Vocation+Level | Score
              const vocLevel = cells[2]?.textContent?.trim() || '';
              const levelMatch = vocLevel.match(/(.+?)\s*[-–]\s*Level\s+(\d+)/i);
              if (levelMatch) {
                vocation = levelMatch[1].trim();
                level = parseInt(levelMatch[2], 10);
              }
              score = parseInt(cells[3]?.textContent?.trim().replace(/[.,\s]/g, '') || '0', 10);
            }

            if (rank > 0 && name) {
              results.push({ rank, name, vocation, level, score });
            }
          }
          if (results.length > 0) break; // found the right table
        }
        return results;
      }
      return [];
    },
    { worldName, categoryValue: categoryFormValue },
  );

  return rows;
}

// ── Main scraper ────────────────────────────────────────────────────────

export async function scrapeHighscores(
  context: BrowserContext,
  opts: ScrapeHighscoresOptions = {},
): Promise<ScrapedHighscoreEntry[]> {
  const worlds = opts.worlds ?? [...WORLDS];
  const professions = opts.professions ?? ['Knights', 'Paladins', 'Sorcerers', 'Druids', 'Monks'] as HighscoreProfession[];
  const categories = opts.categories ?? ['Experience Points'] as HighscoreCategory[];
  const completed = opts.completedCombos ?? new Set<string>();
  const allEntries: ScrapedHighscoreEntry[] = [];
  const browserName = opts.browser ?? 'highscores';
  const headless = opts.headless ?? false;

  // Build queue of (world, category) combos still needed
  // Since the API ignores vocation filter, each (world, category) is 1 request.
  const queue: Array<{ world: string; category: HighscoreCategory }> = [];
  for (const world of worlds) {
    for (const category of categories) {
      const allDone = professions.every(p => completed.has(comboKey(world, p, category)));
      if (!allDone) queue.push({ world, category });
    }
  }

  const totalCombos = worlds.length * categories.length;
  const alreadyDone = totalCombos - queue.length;
  console.log(`  Combos to scrape: ${queue.length}/${totalCombos} (world × category, 1 API request each)`);
  if (alreadyDone > 0) {
    console.log(`  Resuming: ${alreadyDone} combos already done, ${queue.length} remaining`);
  }

  // Get a single page for API calls (just need one tab)
  let page = context.pages()[0] || await context.newPage();

  // Navigate to the site to establish Cloudflare session
  console.log('  Navigating to site for Cloudflare bypass...');
  await navigateWithCloudflare(page, `${RUBINOT_URLS.base}/highscores`, 60_000);
  await sleep(2000);

  // Load world IDs from API
  const worldIds = await fetchWorldIds(page);

  let completedCount = alreadyDone;

  for (const { world, category } of queue) {
    const worldId = worldIds.get(world);
    completedCount++;

    if (worldId === undefined) {
      console.error(`  Unknown world "${world}" — not in API response, skipping`);
      for (const p of professions) opts.onComboDone?.(comboKey(world, p, category));
      continue;
    }

    console.log(`\n[${completedCount}/${totalCombos}] ${world} — ${category}`);

    // ── HTML fallback for categories not supported by the API ──
    if (HTML_ONLY_CATEGORIES.has(category)) {
      const formValue = HIGHSCORE_CATEGORIES[category];
      console.log(`  Using HTML scrape (category form value: ${formValue})`);

      let htmlRows: HtmlHighscoreRow[] = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await rateLimit('fast');
          htmlRows = await scrapeHighscoresFromHtml(page, world, formValue);
          break;
        } catch (err) {
          console.error(`  HTML scrape failed (attempt ${attempt}/3): ${(err as Error).message?.substring(0, 80)}`);
          if (attempt < 3) {
            await sleep(attempt === 1 ? 5000 : 15000);
            try {
              await navigateWithCloudflare(page, `${RUBINOT_URLS.base}/highscores`, 60_000);
              await sleep(2000);
            } catch {
              console.error('  Re-navigation failed, trying new page...');
              try { await closeBrowser(browserName); } catch {}
              const ctx = await getBrowserContext({ headless, browser: browserName });
              page = ctx.pages()[0] || await ctx.newPage();
              await navigateWithCloudflare(page, `${RUBINOT_URLS.base}/highscores`, 60_000);
              await sleep(2000);
              worldIdMap = null;
              await fetchWorldIds(page);
            }
          }
        }
      }

      console.log(`  ${htmlRows.length} entries from HTML`);

      for (const row of htmlRows) {
        const profession = VOCATION_TO_PROFESSION[row.vocation] ?? 'All';
        const entry: ScrapedHighscoreEntry = {
          rank: row.rank,
          characterName: row.name,
          vocation: row.vocation,
          world,
          level: row.level,
          score: BigInt(row.score),
          category,
          profession,
        };
        if (opts.onEntry) await opts.onEntry(entry);
        allEntries.push(entry);
      }

      await opts.onPageDone?.(world, 'All', 1, 1, htmlRows.length);
      for (const p of professions) opts.onComboDone?.(comboKey(world, p, category));
      continue;
    }

    // ── Standard API path ──
    const categoryParam = API_CATEGORY_PARAM[category] || 'experience';

    let data: ApiHighscoreResponse | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await rateLimit('fast');
        data = await fetchHighscoresFromApi(page, worldId, categoryParam);
        break;
      } catch (err) {
        console.error(`  API call failed (attempt ${attempt}/3): ${(err as Error).message?.substring(0, 80)}`);
        if (attempt < 3) {
          const cooldown = attempt === 1 ? 5 : 15;
          await sleep(cooldown * 1000);
          try {
            await navigateWithCloudflare(page, `${RUBINOT_URLS.base}/highscores`, 60_000);
            await sleep(2000);
          } catch {
            console.error('  Re-navigation failed, trying to get new page...');
            try { await closeBrowser(browserName); } catch {}
            const ctx = await getBrowserContext({ headless, browser: browserName });
            page = ctx.pages()[0] || await ctx.newPage();
            await navigateWithCloudflare(page, `${RUBINOT_URLS.base}/highscores`, 60_000);
            await sleep(2000);
            worldIdMap = null;
            await fetchWorldIds(page);
          }
        }
      }
    }

    if (!data || !data.players) {
      console.error(`  All attempts failed — skipping ${world} / ${category}`);
      continue;
    }

    console.log(`  ${data.totalCount} results, ${data.players.length} players received`);

    if (data.players.length === 0) {
      for (const p of professions) opts.onComboDone?.(comboKey(world, p, category));
      continue;
    }

    // Convert API response to our format
    for (const player of data.players) {
      const vocationName = typeof player.vocation === 'number'
        ? (VOCATION_ID_TO_NAME[player.vocation] ?? `Unknown(${player.vocation})`)
        : String(player.vocation);
      const profession = VOCATION_TO_PROFESSION[vocationName] ?? 'All';

      const entry: ScrapedHighscoreEntry = {
        rank: player.rank,
        characterName: player.name,
        vocation: vocationName,
        world,
        level: player.level,
        score: BigInt(player.value),
        category,
        profession,
      };
      if (opts.onEntry) await opts.onEntry(entry);
      allEntries.push(entry);
    }

    await opts.onPageDone?.(world, 'All', 1, 1, data.players.length);

    // Mark all profession combos for this world+category as done
    for (const p of professions) {
      opts.onComboDone?.(comboKey(world, p, category));
    }
  }

  return allEntries;
}
