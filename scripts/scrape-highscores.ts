#!/usr/bin/env tsx
/**
 * CLI script for scraping RubinOT highscores.
 *
 * Usage:
 *   pnpm scrape:highscores                                  # All worlds, all categories, all pages
 *   pnpm scrape:highscores --world Lunarian                 # Single world
 *   pnpm scrape:highscores --category experience            # Single category (use alias or full name)
 *   pnpm scrape:highscores --world Lunarian --category exp  # Specific combo
 *   pnpm scrape:highscores --pages 3                        # First 3 pages per combo
 *   pnpm scrape:highscores --no-db                          # Skip saving to database
 *   pnpm scrape:highscores --headless                       # Run headless (may fail on CF)
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, closeBrowser } from '../src/lib/scraper/browser';
import {
  scrapeHighscores,
  type ScrapedHighscoreEntry,
} from '../src/lib/scraper/highscores';
import {
  WORLDS,
  HIGHSCORE_CATEGORIES,
  CATEGORY_ALIASES,
  type HighscoreCategory,
} from '../src/lib/utils/constants';

const prisma = new PrismaClient();

// ── CLI arg parsing ────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

const hasFlag = (flag: string) => args.includes(flag);

const worldArg = getArg('--world');
const categoryArg = getArg('--category');
const headless = hasFlag('--headless');
const skipDb = hasFlag('--no-db');
const maxPages = getArg('--pages') ? parseInt(getArg('--pages')!, 10) : undefined;

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
RubinOT Highscores Scraper
━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage:
  pnpm scrape:highscores                                  Scrape ALL worlds × ALL categories
  pnpm scrape:highscores --world Lunarian                 Single world, all categories
  pnpm scrape:highscores --category exp                   All worlds, single category
  pnpm scrape:highscores --world Lunarian --category exp  Specific world + category
  pnpm scrape:highscores --pages 3                        Limit to first N pages per combo
  pnpm scrape:highscores --no-db                          Skip saving to database
  pnpm scrape:highscores --headless                       Run headless (may fail on Cloudflare)

Category aliases:
  exp, experience    → Experience Points
  ml, magic          → Magic Level
  fist               → Fist Fighting
  club               → Club Fighting
  sword              → Sword Fighting
  axe                → Axe Fighting
  distance           → Distance Fighting
  shielding          → Shielding
  fishing            → Fishing
  achievements       → Achievements
  battlepass         → Battle Pass
  bounty             → Bounty Points
  charm              → Charm Points
  drome              → Drome Score
  linked             → Linked Tasks
  dailyexp           → Daily Experience (raw)
  loyalty            → Loyalty Points
  prestige           → Prestige Points
  weekly             → Weekly Tasks

Available worlds:
  ${[...WORLDS].join(', ')}

Notes:
  - Each page has 50 entries, up to 20 pages (1000 per world/category)
  - Characters appear on multiple lists — this is expected and useful
  - Data is saved per-day; re-running updates today's snapshot
  - Rate limited with randomized 1–4s delays between requests
`);
  process.exit(0);
}

// ── Resolve world/category args ────────────────────────────────────────

function resolveWorlds(): string[] {
  if (!worldArg) return [...WORLDS];
  const match = [...WORLDS].find((w) => w.toLowerCase() === worldArg.toLowerCase());
  if (!match) {
    console.error(`Unknown world: "${worldArg}". Available: ${[...WORLDS].join(', ')}`);
    process.exit(1);
  }
  return [match];
}

function resolveCategories(): HighscoreCategory[] {
  if (!categoryArg) return Object.keys(HIGHSCORE_CATEGORIES) as HighscoreCategory[];

  // Try exact match first
  const allCategories = Object.keys(HIGHSCORE_CATEGORIES) as HighscoreCategory[];
  const exact = allCategories.find((c) => c.toLowerCase() === categoryArg.toLowerCase());
  if (exact) return [exact];

  // Try alias
  const alias = CATEGORY_ALIASES[categoryArg.toLowerCase()];
  if (alias) return [alias];

  console.error(`Unknown category: "${categoryArg}". Use --help to see available categories.`);
  process.exit(1);
}

// ── Database ────────────────────────────────────────────────────────────

const today = new Date();
today.setHours(0, 0, 0, 0);
let dbSavedCount = 0;

async function upsertHighscoreEntry(e: ScrapedHighscoreEntry): Promise<void> {
  await prisma.highscoreEntry.upsert({
    where: {
      characterName_world_category_capturedDate: {
        characterName: e.characterName,
        world: e.world,
        category: e.category,
        capturedDate: today,
      },
    },
    update: {
      rank: e.rank,
      score: e.score,
      level: e.level,
      vocation: e.vocation,
    },
    create: {
      characterName: e.characterName,
      world: e.world,
      vocation: e.vocation,
      level: e.level,
      category: e.category,
      rank: e.rank,
      score: e.score,
      capturedDate: today,
    },
  });
  dbSavedCount++;
}

// ── Main ───────────────────────────────────────────────────────────────

const todayStr = new Date().toISOString().split('T')[0];
const dataDir = path.join(process.cwd(), 'data');

async function main() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const worlds = resolveWorlds();
  const categories = resolveCategories();

  console.log(`
RubinOT Highscores Scraper
━━━━━━━━━━━━━━━━━━━━━━━━━━
  Worlds:     ${worlds.join(', ')}
  Categories: ${categories.join(', ')}
  Max pages:  ${maxPages ?? 'all'}
  Save to DB: ${skipDb ? 'no' : 'yes'}
`);

  console.log('Launching browser...');
  const context = await getBrowserContext({ headless });
  const page = context.pages()[0] || (await context.newPage());

  try {
    const onEntry = skipDb ? undefined : async (e: ScrapedHighscoreEntry) => {
      await upsertHighscoreEntry(e);
    };

    const entries = await scrapeHighscores(page, {
      worlds,
      categories,
      maxPages,
      onEntry,
      onPageDone: (world, category, p, totalPages, count) => {
        console.log(`  Page ${p}/${totalPages}: ${count} entries`);
      },
    });

    // Save JSON output
    const outFile = path.join(dataDir, `highscores-${todayStr}.json`);
    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'highscores',
      worlds,
      categories,
      totalEntries: entries.length,
      // Serialize bigints as strings for JSON
      entries: entries.map((e) => ({ ...e, score: e.score.toString() })),
    };
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`\nSaved ${entries.length} entries to ${outFile}`);
    if (!skipDb) console.log(`${dbSavedCount} entries saved/updated in database`);

    printSummary(entries);
  } finally {
    await prisma.$disconnect();
    await closeBrowser();
  }
}

// ── Pretty output ──────────────────────────────────────────────────────

function printSummary(entries: ScrapedHighscoreEntry[]) {
  const byWorld: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const uniqueNames = new Set<string>();

  for (const e of entries) {
    byWorld[e.world] = (byWorld[e.world] || 0) + 1;
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    uniqueNames.add(`${e.characterName}@${e.world}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Highscores Scrape Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total entries:      ${entries.length}
  Unique characters:  ${uniqueNames.size}

  By World:
${Object.entries(byWorld)
  .sort((a, b) => b[1] - a[1])
  .map(([w, c]) => `    ${w}: ${c}`)
  .join('\n')}

  By Category:
${Object.entries(byCategory)
  .sort((a, b) => b[1] - a[1])
  .map(([cat, c]) => `    ${cat}: ${c}`)
  .join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch((err) => {
  console.error('Highscores scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser()).finally(() => process.exit(1));
});
