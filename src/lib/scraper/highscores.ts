/**
 * Highscores scraper for RubinOT.
 * Uses the JSON API at /api/highscores — supports experience + all skill categories + charm.
 * Returns up to 1,000 entries per world×category×vocation in one request.
 * Still needs Brave Browser to bypass Cloudflare on the first request.
 */
import {
  RUBINOT_URLS,
  WORLDS,
  HIGHSCORE_PROFESSIONS,
  HIGHSCORE_CATEGORIES,
  DAILY_CATEGORIES,
  PROFESSION_SKIP_CATEGORIES,
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
  'Charm Points': 'charmtotalpoints',
  'Bounty Points': 'bountytask',
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

/**
 * Map profession filter → promoted vocation name.
 * The RubinOT API's vocation ID field is unreliable (changed mapping ~Feb 25 2026),
 * so we derive vocation from the profession filter used for the request instead.
 */
const PROFESSION_DEFAULT_VOCATION: Record<string, string> = {
  'Knights': 'Elite Knight',
  'Paladins': 'Royal Paladin',
  'Sorcerers': 'Master Sorcerer',
  'Druids': 'Elder Druid',
  'Monks': 'Exalted Monk',
};

// ── Categories that need HTML scraping (not supported by API) ─────

const HTML_ONLY_CATEGORIES = new Set<string>();

/** Map profession group names to API vocation filter values */
const PROFESSION_TO_API_VOCATION: Record<string, string> = {
  'Knights': '5',
  'Paladins': '4',
  'Sorcerers': '2',
  'Druids': '3',
  'Monks': '9',
};

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
  vocationParam: string = '0',
): Promise<ApiHighscoreResponse> {
  const url = `/api/highscores?world=${worldId}&category=${categoryParam}&vocation=${vocationParam}&page=1`;

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

  // Build queue of (world, category, profession) combos still needed.
  // Each combo is 1 API request returning up to 1,000 entries for that vocation.
  const skipMap = PROFESSION_SKIP_CATEGORIES as Record<string, string[] | undefined>;
  const queue: Array<{ world: string; category: HighscoreCategory; profession: HighscoreProfession }> = [];
  for (const world of worlds) {
    for (const category of categories) {
      for (const profession of professions) {
        if (completed.has(comboKey(world, profession, category))) continue;
        // Skip categories irrelevant to this vocation
        const skips = skipMap[profession];
        if (skips && skips.includes(category)) continue;
        queue.push({ world, category, profession });
      }
    }
  }

  // Count total expected combos (excluding skipped)
  let totalCombos = 0;
  for (const world of worlds) {
    for (const category of categories) {
      for (const profession of professions) {
        const skips = skipMap[profession];
        if (skips && skips.includes(category)) continue;
        totalCombos++;
      }
    }
  }
  const alreadyDone = totalCombos - queue.length;
  console.log(`  Combos to scrape: ${queue.length}/${totalCombos} (world × category × vocation)`);
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

  for (const { world, category, profession } of queue) {
    const worldId = worldIds.get(world);
    completedCount++;

    if (worldId === undefined) {
      console.error(`  Unknown world "${world}" — not in API response, skipping`);
      opts.onComboDone?.(comboKey(world, profession, category));
      continue;
    }

    console.log(`\n[${completedCount}/${totalCombos}] ${world} — ${category} — ${profession}`);

    // ── Standard API path ──
    const categoryParam = API_CATEGORY_PARAM[category] || 'experience';
    const vocationParam = PROFESSION_TO_API_VOCATION[profession] || '0';

    let data: ApiHighscoreResponse | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await rateLimit('fast');
        data = await fetchHighscoresFromApi(page, worldId, categoryParam, vocationParam);
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
      console.error(`  All attempts failed — skipping ${world} / ${category} / ${profession}`);
      opts.onComboDone?.(comboKey(world, profession, category));
      continue;
    }

    console.log(`  ${data.totalCount} results, ${data.players.length} players received`);

    if (data.players.length === 0) {
      opts.onComboDone?.(comboKey(world, profession, category));
      continue;
    }

    // Convert API response to our format
    // Use profession filter to derive vocation (API vocation IDs are unreliable)
    const derivedVocation = PROFESSION_DEFAULT_VOCATION[profession] || 'Unknown';

    for (const player of data.players) {
      const entry: ScrapedHighscoreEntry = {
        rank: player.rank,
        characterName: player.name,
        vocation: derivedVocation,
        world,
        level: player.level,
        score: BigInt(player.value),
        category,
        profession,
      };
      if (opts.onEntry) await opts.onEntry(entry);
      allEntries.push(entry);
    }

    await opts.onPageDone?.(world, profession, 1, 1, data.players.length);
    opts.onComboDone?.(comboKey(world, profession, category));
  }

  return allEntries;
}
