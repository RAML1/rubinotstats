/**
 * Experience Points highscores scraper for RubinOT.
 * Uses the JSON API at /api/highscores — returns all 1,000 entries per world in one request.
 * NOTE: The API ignores the vocation filter — always returns top 1,000 across all vocations.
 * Still needs Brave Browser to bypass Cloudflare on the first request.
 */
import {
  RUBINOT_URLS,
  WORLDS,
  HIGHSCORE_PROFESSIONS,
  type HighscoreProfession,
} from '../utils/constants';
import type { Page, BrowserContext } from 'playwright';
import { navigateWithCloudflare, rateLimit, getBrowserContext, closeBrowser, sleep } from './browser';
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

export interface ScrapeHighscoresOptions {
  worlds?: string[];
  professions?: HighscoreProfession[];
  maxPages?: number; // kept for CLI compat but ignored (API returns all at once)
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
): Promise<ApiHighscoreResponse> {
  const url = `/api/highscores?world=${worldId}&category=experience&vocation=all&page=1`;

  return page.evaluate(async (apiUrl: string) => {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Highscores API ${res.status}: ${res.statusText}`);
    return res.json();
  }, url);
}

// ── Main scraper ────────────────────────────────────────────────────────

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

  // Since the API ignores vocation filter, we only need 1 request per world.
  // Build world queue (skip worlds where ALL professions are already completed)
  const worldQueue: string[] = [];
  for (const world of worlds) {
    const allDone = professions.every(p => completed.has(comboKey(world, p)));
    if (!allDone) worldQueue.push(world);
  }

  const totalWorlds = worlds.length;
  const alreadyDone = totalWorlds - worldQueue.length;
  console.log(`  Worlds to scrape: ${worldQueue.length}/${totalWorlds} (1 API request per world)`);
  if (alreadyDone > 0) {
    console.log(`  Resuming: ${alreadyDone} worlds already done, ${worldQueue.length} remaining`);
  }

  // Get a single page for API calls (just need one tab)
  let page = context.pages()[0] || await context.newPage();

  // Navigate to the site to establish Cloudflare session
  console.log('  Navigating to site for Cloudflare bypass...');
  await navigateWithCloudflare(page, `${RUBINOT_URLS.base}/highscores`, 60_000);
  await sleep(2000);

  // Load world IDs from API
  const worldIds = await fetchWorldIds(page);

  let completedWorldCount = alreadyDone;

  for (const world of worldQueue) {
    const worldId = worldIds.get(world);
    completedWorldCount++;

    if (worldId === undefined) {
      console.error(`  Unknown world "${world}" — not in API response, skipping`);
      for (const p of professions) opts.onComboDone?.(comboKey(world, p));
      continue;
    }

    console.log(`\n[${completedWorldCount}/${totalWorlds}] ${world}`);

    let data: ApiHighscoreResponse | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await rateLimit('fast');
        data = await fetchHighscoresFromApi(page, worldId);
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
      console.error(`  All attempts failed — skipping ${world}`);
      continue;
    }

    console.log(`  ${data.totalCount} results, ${data.players.length} players received`);

    if (data.players.length === 0) {
      for (const p of professions) opts.onComboDone?.(comboKey(world, p));
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
        category: 'Experience Points',
        profession,
      };
      if (opts.onEntry) await opts.onEntry(entry);
      allEntries.push(entry);
    }

    opts.onPageDone?.(world, 'All', 1, 1, data.players.length);

    // Mark all profession combos for this world as done
    for (const p of professions) {
      opts.onComboDone?.(comboKey(world, p));
    }
  }

  return allEntries;
}
