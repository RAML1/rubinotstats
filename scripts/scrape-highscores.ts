#!/usr/bin/env tsx
/**
 * CLI script for scraping RubinOT experience highscores.
 *
 * Scrapes Experience Points leaderboard across all worlds and vocations.
 *
 * Usage:
 *   pnpm scrape:highscores                          # All worlds, all vocations
 *   pnpm scrape:highscores --world Lunarian          # Single world
 *   pnpm scrape:highscores --vocation knights        # Single vocation
 *   pnpm scrape:highscores --pages 3                 # First 3 pages per combo
 *   pnpm scrape:highscores --no-db                   # Skip saving to database
 *   pnpm scrape:highscores --headless                # Run headless (may fail on CF)
 *   pnpm scrape:highscores --fresh                   # Ignore progress, start from scratch
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, closeBrowser, type BrowserName } from '../src/lib/scraper/browser';

const BROWSER: BrowserName = 'highscores';
import {
  scrapeHighscores,
  comboKey,
  type ScrapedHighscoreEntry,
} from '../src/lib/scraper/highscores';
import {
  WORLDS,
  HIGHSCORE_PROFESSIONS,
  PROFESSION_ALIASES,
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
const vocationArg = getArg('--vocation');
const headless = hasFlag('--headless');
const skipDb = hasFlag('--no-db');
const freshStart = hasFlag('--fresh');
const maxPages = getArg('--pages') ? parseInt(getArg('--pages')!, 10) : undefined;

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
RubinOT Experience Highscores Scraper (API mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage:
  pnpm scrape:highscores                          All worlds, all vocations
  pnpm scrape:highscores --world Lunarian          Single world
  pnpm scrape:highscores --vocation knights        Single vocation
  pnpm scrape:highscores --no-db                   Skip saving to database
  pnpm scrape:highscores --fresh                   Ignore progress, start from scratch
  pnpm scrape:highscores --headless                Run headless (may fail on Cloudflare)

Vocation aliases:
  knights, ek        → Knights
  paladins, rp       → Paladins
  sorcerers, ms      → Sorcerers
  druids, ed         → Druids
  monks              → Monks

Available worlds:
  ${[...WORLDS].join(', ')}

Notes:
  - Uses JSON API at /api/highscores (1 request per combo, up to 1000 results)
  - 14 worlds × 5 vocations = 70 combos
  - Progress tracked in data/progress-YYYY-MM-DD.json
`);
  process.exit(0);
}

// ── Resolve world/vocation args ──────────────────────────────────────

function resolveWorlds(): string[] {
  if (!worldArg) return [...WORLDS];
  const match = [...WORLDS].find((w) => w.toLowerCase() === worldArg.toLowerCase());
  if (!match) {
    console.error(`Unknown world: "${worldArg}". Available: ${[...WORLDS].join(', ')}`);
    process.exit(1);
  }
  return [match];
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
  return ['Knights', 'Paladins', 'Sorcerers', 'Druids', 'Monks'];
}

// ── Progress file (resume support) ───────────────────────────────────

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
  const professions = resolveProfessions();
  const totalCombos = worlds.length * professions.length;

  const completedCombos = loadProgress();

  console.log(`
RubinOT Experience Highscores
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Worlds:      ${worlds.join(', ')}
  Vocations:   ${professions.join(', ')}
  Combos:      ${totalCombos}
  Max pages:   ${maxPages ?? 'all'}
  Save to DB:  ${skipDb ? 'no' : 'yes'}
  Resume:      ${completedCombos.size > 0 ? `yes (${completedCombos.size} done)` : 'fresh start'}
`);

  console.log(`Launching browser (${BROWSER}) for API mode...`);
  const context = await getBrowserContext({ headless, browser: BROWSER });

  const startTime = Date.now();

  try {
    const onEntry = skipDb ? undefined : async (e: ScrapedHighscoreEntry) => {
      await upsertHighscoreEntry(e);
    };

    const entries = await scrapeHighscores(context, {
      worlds,
      professions,
      maxPages,
      headless,
      browser: BROWSER,
      completedCombos,
      onEntry,
      onPageDone: (_world, _profession, p, totalPages, count) => {
        console.log(`  Page ${p}/${totalPages}: ${count} entries`);
      },
      onComboDone: (key) => {
        completedCombos.add(key);
        saveProgress(completedCombos);
      },
    });

    // Save JSON output
    const outFile = path.join(dataDir, `highscores-${todayStr}.json`);
    let existingEntries: any[] = [];
    if (!freshStart && fs.existsSync(outFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
        existingEntries = existing.entries ?? [];
      } catch {}
    }

    const allEntries = [
      ...existingEntries,
      ...entries.map((e) => ({ ...e, score: e.score.toString() })),
    ];

    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'highscores',
      category: 'Experience Points',
      worlds,
      professions,
      totalEntries: allEntries.length,
      entries: allEntries,
    };
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\nSaved ${entries.length} new entries to ${outFile} (${allEntries.length} total)`);
    if (!skipDb) console.log(`${dbSavedCount} entries saved/updated in database`);
    console.log(`Completed combos: ${completedCombos.size}/${totalCombos}`);
    console.log(`Total time: ${elapsed} minutes`);

    if (completedCombos.size >= totalCombos) {
      console.log('\nAll combos completed! Cleaning up progress file...');
      if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile);
    }

    // Refresh materialized views used by progression + premium pages
    if (!skipDb) {
      console.log('\nRefreshing materialized views...');
      try {
        await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY world_leaders_mv');
        console.log('✓ world_leaders_mv refreshed');
        await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY top_exp_gainers_mv');
        console.log('✓ top_exp_gainers_mv refreshed');
      } catch (e) {
        console.error('Failed to refresh materialized views:', e);
      }
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
  const byVocation: Record<string, number> = {};
  const uniqueNames = new Set<string>();

  for (const e of entries) {
    byWorld[e.world] = (byWorld[e.world] || 0) + 1;
    byVocation[e.vocation] = (byVocation[e.vocation] || 0) + 1;
    uniqueNames.add(`${e.characterName}@${e.world}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Experience Highscores Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total entries:      ${entries.length}
  Unique characters:  ${uniqueNames.size}

  By World:
${Object.entries(byWorld)
  .sort((a, b) => b[1] - a[1])
  .map(([w, c]) => `    ${w}: ${c}`)
  .join('\n')}

  By Vocation:
${Object.entries(byVocation)
  .sort((a, b) => b[1] - a[1])
  .map(([p, c]) => `    ${p}: ${c}`)
  .join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch((err) => {
  console.error('Highscores scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
