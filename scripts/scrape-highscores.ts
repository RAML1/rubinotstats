#!/usr/bin/env tsx
/**
 * CLI script for scraping RubinOT highscores.
 *
 * Usage:
 *   pnpm scrape:highscores                                  # All worlds, all categories, all vocations
 *   pnpm scrape:highscores --world Lunarian                 # Single world
 *   pnpm scrape:highscores --category experience            # Single category (use alias or full name)
 *   pnpm scrape:highscores --vocation knights               # Single vocation filter
 *   pnpm scrape:highscores --world Lunarian --category exp  # Specific combo
 *   pnpm scrape:highscores --pages 3                        # First 3 pages per combo
 *   pnpm scrape:highscores --no-db                          # Skip saving to database
 *   pnpm scrape:highscores --headless                       # Run headless (may fail on CF)
 *   pnpm scrape:highscores --fresh                          # Ignore progress file, start from scratch
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, closeBrowser, type BrowserName } from '../src/lib/scraper/browser';

const BROWSER: BrowserName = 'highscores';
import {
  scrapeHighscores,
  comboKey,
  shouldSkipCombo,
  type ScrapedHighscoreEntry,
} from '../src/lib/scraper/highscores';
import {
  WORLDS,
  HIGHSCORE_CATEGORIES,
  HIGHSCORE_PROFESSIONS,
  DAILY_CATEGORIES,
  DAILY_PROFESSIONS,
  CATEGORY_ALIASES,
  PROFESSION_ALIASES,
  type HighscoreCategory,
  type HighscoreProfession,
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
const vocationArg = getArg('--vocation');
const headless = hasFlag('--headless');
const skipDb = hasFlag('--no-db');
const fullScrape = hasFlag('--all');
const freshStart = hasFlag('--fresh');
const maxPages = getArg('--pages') ? parseInt(getArg('--pages')!, 10) : undefined;

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
RubinOT Highscores Scraper
━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage:
  pnpm scrape:highscores                                  Scrape ALL worlds × ALL categories × ALL vocations
  pnpm scrape:highscores --world Lunarian                 Single world, all categories
  pnpm scrape:highscores --category exp                   All worlds, single category
  pnpm scrape:highscores --vocation knights               All worlds, all categories, single vocation
  pnpm scrape:highscores --world Lunarian --category exp  Specific world + category
  pnpm scrape:highscores --pages 3                        Limit to first N pages per combo
  pnpm scrape:highscores --no-db                          Skip saving to database
  pnpm scrape:highscores --all                             ALL categories × ALL vocations (including "All")
  pnpm scrape:highscores --fresh                           Ignore progress file, start from scratch
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

Vocation aliases:
  all                → All (no filter)
  knights, ek        → Knights
  paladins, rp       → Paladins
  sorcerers, ms      → Sorcerers
  druids, ed         → Druids
  monks              → Monks

Available worlds:
  ${[...WORLDS].join(', ')}

Skip rules (irrelevant vocation/skill combos are auto-skipped):
  Paladins:  skip Sword, Axe, Shield, Club, Fist
  Sorcerers: skip Sword, Axe, Shield, Club, Distance, Fist
  Druids:    skip Sword, Axe, Shield, Club, Distance, Fist
  Knights:   skip Distance, Fist
  Monks:     skip Sword, Shield, Axe, Club, Distance

Notes:
  - Each page has 50 entries, up to 20 pages (1000 per world/category/vocation)
  - Default daily: ~574 relevant combos (910 minus irrelevant skill/vocation pairs)
  - Full run (--all): 14 worlds × 19 categories × 6 professions (minus skips)
  - Characters appear on multiple lists — this is expected and useful
  - Data is saved per-day; re-running resumes from where it left off
  - Progress tracked in data/progress-YYYY-MM-DD.json
  - Use --fresh to ignore progress and start over
`);
  process.exit(0);
}

// ── Resolve world/category/vocation args ──────────────────────────────

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
  if (categoryArg) {
    const allCategories = Object.keys(HIGHSCORE_CATEGORIES) as HighscoreCategory[];
    const exact = allCategories.find((c) => c.toLowerCase() === categoryArg.toLowerCase());
    if (exact) return [exact];

    const alias = CATEGORY_ALIASES[categoryArg.toLowerCase()];
    if (alias) return [alias];

    console.error(`Unknown category: "${categoryArg}". Use --help to see available categories.`);
    process.exit(1);
  }
  return fullScrape
    ? (Object.keys(HIGHSCORE_CATEGORIES) as HighscoreCategory[])
    : DAILY_CATEGORIES;
}

function resolveProfessions(): HighscoreProfession[] {
  if (vocationArg) {
    const allProfessions = Object.keys(HIGHSCORE_PROFESSIONS) as HighscoreProfession[];
    const exact = allProfessions.find((p) => p.toLowerCase() === vocationArg.toLowerCase());
    if (exact) return [exact];

    const alias = PROFESSION_ALIASES[vocationArg.toLowerCase()];
    if (alias) return [alias];

    console.error(`Unknown vocation: "${vocationArg}". Use --help to see available vocations.`);
    process.exit(1);
  }
  return fullScrape
    ? (Object.keys(HIGHSCORE_PROFESSIONS) as HighscoreProfession[])
    : DAILY_PROFESSIONS;
}

// ── Progress file (resume support) ───────────────────────────────────

// Use local date (not UTC) for consistency
const now = new Date();
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const dataDir = path.join(process.cwd(), 'data');
const progressFile = path.join(dataDir, `progress-${todayStr}.json`);

function loadProgress(): Set<string> {
  if (freshStart) return new Set();
  try {
    if (fs.existsSync(progressFile)) {
      const data = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      return new Set(data.completed as string[]);
    }
  } catch {
    // Corrupt file, start fresh
  }
  return new Set();
}

function saveProgress(completed: Set<string>): void {
  const data = {
    date: todayStr,
    updatedAt: new Date().toISOString(),
    completed: [...completed],
  };
  fs.writeFileSync(progressFile, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Database ────────────────────────────────────────────────────────────

// Use UTC midnight for DB date — must match across runs
const today = new Date(todayStr + 'T00:00:00.000Z');
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

async function main() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const worlds = resolveWorlds();
  const categories = resolveCategories();
  const professions = resolveProfessions();

  // Count relevant combos (after skip rules)
  let relevantCombos = 0;
  for (const _w of worlds) {
    for (const cat of categories) {
      for (const prof of professions) {
        if (!shouldSkipCombo(cat, prof)) relevantCombos++;
      }
    }
  }

  // Load resume progress
  const completedCombos = loadProgress();

  console.log(`
RubinOT Highscores Scraper
━━━━━━━━━━━━━━━━━━━━━━━━━━
  Worlds:      ${worlds.join(', ')}
  Categories:  ${categories.join(', ')}
  Vocations:   ${professions.join(', ')}
  Combos:      ${relevantCombos} relevant
  Max pages:   ${maxPages ?? 'all'}
  Save to DB:  ${skipDb ? 'no' : 'yes'}
  Resume:      ${completedCombos.size > 0 ? `yes (${completedCombos.size} done)` : 'fresh start'}
`);

  console.log(`Launching browser (${BROWSER})...`);
  const context = await getBrowserContext({ headless, browser: BROWSER });
  const page = context.pages()[0] || (await context.newPage());

  const startTime = Date.now();

  try {
    const onEntry = skipDb ? undefined : async (e: ScrapedHighscoreEntry) => {
      await upsertHighscoreEntry(e);
    };

    const entries = await scrapeHighscores(page, {
      worlds,
      categories,
      professions,
      maxPages,
      completedCombos,
      onEntry,
      onPageDone: (_world, _category, _profession, p, totalPages, count) => {
        console.log(`  Page ${p}/${totalPages}: ${count} entries`);
      },
      onComboDone: (key) => {
        completedCombos.add(key);
        saveProgress(completedCombos);
      },
    });

    // Save JSON output (append to existing if resuming)
    const outFile = path.join(dataDir, `highscores-${todayStr}.json`);
    let existingEntries: any[] = [];
    if (!freshStart && fs.existsSync(outFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
        existingEntries = existing.entries ?? [];
      } catch {
        // Corrupt file, ignore
      }
    }

    const allEntries = [
      ...existingEntries,
      ...entries.map((e) => ({ ...e, score: e.score.toString() })),
    ];

    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'highscores',
      worlds,
      categories,
      professions,
      totalEntries: allEntries.length,
      entries: allEntries,
    };
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\nSaved ${entries.length} new entries to ${outFile} (${allEntries.length} total)`);
    if (!skipDb) console.log(`${dbSavedCount} entries saved/updated in database`);
    console.log(`Completed combos: ${completedCombos.size}/${relevantCombos}`);
    console.log(`Total time: ${elapsed} minutes`);

    if (completedCombos.size >= relevantCombos) {
      console.log('\nAll combos completed! Cleaning up progress file...');
      if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile);
    }

    printSummary(entries);
  } finally {
    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

// ── Pretty output ──────────────────────────────────────────────────────

function printSummary(entries: ScrapedHighscoreEntry[]) {
  if (entries.length === 0) {
    console.log('\nNo new entries scraped this run.');
    return;
  }

  const byWorld: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byProfession: Record<string, number> = {};
  const uniqueNames = new Set<string>();

  for (const e of entries) {
    byWorld[e.world] = (byWorld[e.world] || 0) + 1;
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    byProfession[e.profession] = (byProfession[e.profession] || 0) + 1;
    uniqueNames.add(`${e.characterName}@${e.world}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Highscores Scrape Summary (this run)
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

  By Vocation:
${Object.entries(byProfession)
  .sort((a, b) => b[1] - a[1])
  .map(([p, c]) => `    ${p}: ${c}`)
  .join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch((err) => {
  console.error('Highscores scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
