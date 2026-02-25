#!/usr/bin/env tsx
/**
 * Auction scraper that iterates by ID — no pagination needed.
 *
 * Walks auction IDs (newest → oldest by default) and scrapes each detail page
 * directly. Skips IDs already in the database. Saves each auction to DB
 * immediately and writes progress to disk so it can resume after a crash.
 *
 * Usage:
 *   pnpm scrape:ids                         # Scan from latest known → newest on site
 *   pnpm scrape:ids --from 150000           # Start from a specific ID
 *   pnpm scrape:ids --from 150000 --to 155000  # Scan a specific range
 *   pnpm scrape:ids --count 200             # Stop after 200 new auctions saved
 *   pnpm scrape:ids --reverse               # Scan oldest → newest (ascending IDs)
 *   pnpm scrape:ids --resume                # Resume from last saved progress
 *   pnpm scrape:ids --headless              # Run headless (may fail on Cloudflare)
 *   pnpm scrape:ids --no-db                 # Skip database saves
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, closeBrowser, navigateWithCloudflare, rateLimit, getHealthyPage, sleep } from '../src/lib/scraper/browser';
import type { BrowserName } from '../src/lib/scraper/browser';
import { scrapeSingleAuction, type ScrapedAuction } from '../src/lib/scraper/auctions';
import { RUBINOT_URLS } from '../src/lib/utils/constants';

const BROWSER: BrowserName = 'auctions';
const prisma = new PrismaClient();

// ── CLI arg parsing ────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

const hasFlag = (flag: string) => args.includes(flag);

const fromId = getArg('--from') ? parseInt(getArg('--from')!, 10) : null;
const toId = getArg('--to') ? parseInt(getArg('--to')!, 10) : null;
const maxCount = getArg('--count') ? parseInt(getArg('--count')!, 10) : undefined;
const headless = hasFlag('--headless');
const skipDb = hasFlag('--no-db');
const reverse = hasFlag('--reverse');
const resumeFlag = hasFlag('--resume');

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
RubinOT Auction Scraper (by ID)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scrapes auction detail pages directly by ID — no list page pagination.

Usage:
  pnpm scrape:ids                              Scan from latest DB ID upward
  pnpm scrape:ids --from 150000               Start from specific ID
  pnpm scrape:ids --from 150000 --to 155000   Scan a range
  pnpm scrape:ids --count 200                 Stop after 200 new auctions
  pnpm scrape:ids --reverse                   Scan ascending (old → new)
  pnpm scrape:ids --resume                    Resume from last progress file
  pnpm scrape:ids --headless                  Run headless
  pnpm scrape:ids --no-db                     Skip database saves

Progress is saved after every auction to data/progress-ids.json.
`);
  process.exit(0);
}

// ── Progress tracking ──────────────────────────────────────────────────

const dataDir = path.join(process.cwd(), 'data');
const progressFile = path.join(dataDir, 'progress-ids.json');

interface Progress {
  lastScannedId: number;
  direction: 'asc' | 'desc';
  savedCount: number;
  skippedCount: number;
  notFoundCount: number;
  consecutiveNotFound: number;
  startedAt: string;
  updatedAt: string;
}

function loadProgress(): Progress | null {
  try {
    if (fs.existsSync(progressFile)) {
      return JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveProgress(progress: Progress): void {
  progress.updatedAt = new Date().toISOString();
  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2), 'utf-8');
}

// ── Database helpers ───────────────────────────────────────────────────

async function upsertAuction(a: ScrapedAuction): Promise<void> {
  const data = {
    characterName: a.characterName,
    level: a.level,
    vocation: a.vocation,
    gender: a.gender,
    world: a.world,
    auctionStart: a.auctionStart,
    auctionEnd: a.auctionEnd,
    auctionStatus: a.auctionStatus,
    soldPrice: a.soldPrice,
    coinsPerLevel: a.coinsPerLevel,
    magicLevel: a.magicLevel,
    fist: a.fist,
    club: a.club,
    sword: a.sword,
    axe: a.axe,
    distance: a.distance,
    shielding: a.shielding,
    fishing: a.fishing,
    hitPoints: a.hitPoints,
    mana: a.mana,
    capacity: a.capacity,
    speed: a.speed,
    experience: a.experience,
    creationDate: a.creationDate,
    achievementPoints: a.achievementPoints,
    mountsCount: a.mountsCount,
    outfitsCount: a.outfitsCount,
    titlesCount: a.titlesCount,
    linkedTasks: a.linkedTasks,
    dailyRewardStreak: a.dailyRewardStreak,
    charmExpansion: a.charmExpansion,
    charmPoints: a.charmPoints,
    unusedCharmPoints: a.unusedCharmPoints,
    spentCharmPoints: a.spentCharmPoints,
    preySlots: a.preySlots,
    preyWildcards: a.preyWildcards,
    huntingTaskPoints: a.huntingTaskPoints,
    hirelings: a.hirelings,
    hirelingJobs: a.hirelingJobs,
    hasLootPouch: a.hasLootPouch,
    storeItemsCount: a.storeItemsCount,
    bossPoints: a.bossPoints,
    blessingsCount: a.blessingsCount,
    exaltedDust: a.exaltedDust,
    gold: a.gold,
    bestiary: a.bestiary,
    primalOrdealAvailable: a.primalOrdealAvailable,
    soulWarAvailable: a.soulWarAvailable,
    sanguineBloodAvailable: a.sanguineBloodAvailable,
    magicLevelPct: a.magicLevelPct,
    fistPct: a.fistPct,
    clubPct: a.clubPct,
    swordPct: a.swordPct,
    axePct: a.axePct,
    distancePct: a.distancePct,
    shieldingPct: a.shieldingPct,
    fishingPct: a.fishingPct,
    outfitImageUrl: a.outfitImageUrl,
    gems: a.gems,
    weeklyTaskExpansion: a.weeklyTaskExpansion,
    battlePassDeluxe: a.battlePassDeluxe,
    displayItems: a.displayItems,
    outfitNames: a.outfitNames,
    mountNames: a.mountNames,
    url: a.url,
  };
  await prisma.auction.upsert({
    where: { externalId: a.externalId },
    update: data,
    create: { externalId: a.externalId, ...data },
  });
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load existing auction IDs from DB for fast skip checks
  const existing = await prisma.auction.findMany({ select: { externalId: true } });
  const existingIds = new Set(existing.map((e) => parseInt(e.externalId, 10)));
  console.log(`Found ${existingIds.size} existing auctions in DB`);

  // Determine scan range and direction
  // Default direction: ascending (scan upward from max known ID to find new auctions)
  // --reverse flips to descending (scan backward to fill gaps)
  let startId: number;
  let endId: number;
  let direction: 'asc' | 'desc';

  if (resumeFlag) {
    const prev = loadProgress();
    if (!prev) {
      console.error('No progress file found. Run without --resume first.');
      process.exit(1);
    }
    direction = prev.direction;
    startId = prev.lastScannedId + (prev.direction === 'asc' ? 1 : -1);
    endId = direction === 'asc' ? (toId ?? 999999) : (toId ?? 1);
    console.log(`Resuming from ID ${startId} (${prev.savedCount} saved previously)`);
  } else if (fromId) {
    direction = reverse ? 'desc' : 'asc';
    startId = fromId;
    endId = direction === 'asc' ? (toId ?? 999999) : (toId ?? 1);
  } else {
    // Default: start from max existing ID + 1, scan upward to find new auctions
    direction = 'asc';
    const maxExisting = Math.max(...existingIds);
    startId = maxExisting + 1;
    endId = toId ?? startId + 10000; // scan up to 10k IDs ahead
    console.log(`Starting from ID ${startId} (max in DB: ${maxExisting})`);
  }

  console.log(`Scanning IDs ${startId} → ${endId} (${direction === 'asc' ? 'ascending' : 'descending'})`);
  if (maxCount) console.log(`Will stop after ${maxCount} new auctions`);

  // Launch browser with a pool of tabs to rotate through Cloudflare challenges
  const TAB_COUNT = 3;
  console.log(`\nLaunching browser (${BROWSER}) with ${TAB_COUNT} tabs...`);
  let context = await getBrowserContext({ headless, browser: BROWSER });

  // Create tab pool
  const tabs: import('playwright').Page[] = [];
  const existingPages = context.pages();
  for (let i = 0; i < TAB_COUNT; i++) {
    tabs.push(existingPages[i] || (await context.newPage()));
  }
  let tabIndex = 0;
  const nextTab = () => {
    tabIndex = (tabIndex + 1) % tabs.length;
    return tabs[tabIndex];
  };

  // Navigate to the site to establish Cloudflare session (required for API fetch)
  console.log('Navigating to bazaar for Cloudflare bypass...');
  await navigateWithCloudflare(tabs[0], `${RUBINOT_URLS.base}/bazaar`, 60_000);
  await sleep(2000);

  const progress: Progress = {
    lastScannedId: startId,
    direction,
    savedCount: 0,
    skippedCount: 0,
    notFoundCount: 0,
    consecutiveNotFound: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // If resuming, carry over counts
  if (resumeFlag) {
    const prev = loadProgress();
    if (prev) {
      progress.savedCount = prev.savedCount;
      progress.skippedCount = prev.skippedCount;
      progress.notFoundCount = prev.notFoundCount;
    }
  }

  const step = direction === 'asc' ? 1 : -1;
  const shouldContinue = (id: number) =>
    direction === 'asc' ? id <= endId : id >= endId;

  // Stop after 100 consecutive not-found IDs (we've gone past the range)
  const MAX_CONSECUTIVE_NOT_FOUND = 100;
  let consecutiveErrors = 0;
  let tabReplacementRounds = 0; // tracks how many times we've replaced tabs without success

  try {
    for (let id = startId; shouldContinue(id); id += step) {
      // Skip if already in DB
      if (existingIds.has(id)) {
        progress.skippedCount++;
        progress.lastScannedId = id;
        // Don't save progress on every skip — too noisy. Save every 50 skips.
        if (progress.skippedCount % 50 === 0) saveProgress(progress);
        continue;
      }

      // Stop conditions
      if (maxCount && progress.savedCount >= maxCount) {
        console.log(`\nReached target of ${maxCount} new auctions — stopping.`);
        break;
      }
      if (progress.consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
        console.log(`\n${MAX_CONSECUTIVE_NOT_FOUND} consecutive IDs with no auction — stopping.`);
        break;
      }

      await rateLimit();

      // Rotate tabs on each request — spreads Cloudflare challenges across tabs
      let page = nextTab();

      // Try to scrape this auction
      try {
        const auction = await scrapeSingleAuction(page, String(id));
        consecutiveErrors = 0; // successful page load
        tabReplacementRounds = 0;

        if (!auction) {
          progress.notFoundCount++;
          progress.consecutiveNotFound++;
          progress.lastScannedId = id;
          if (progress.consecutiveNotFound % 10 === 0) {
            process.stdout.write(`  (${progress.consecutiveNotFound} consecutive empty)\r`);
          }
          saveProgress(progress);
          continue;
        }

        // Reset consecutive not-found counter
        progress.consecutiveNotFound = 0;

        // Save to DB immediately
        if (!skipDb) {
          await upsertAuction(auction);
        }

        progress.savedCount++;
        progress.lastScannedId = id;
        saveProgress(progress);

        // Log the find
        const status = auction.auctionStatus ?? 'unknown';
        const priceStr = auction.soldPrice ? `${auction.soldPrice} TC` : status;
        console.log(
          `  [${progress.savedCount}${maxCount ? '/' + maxCount : ''}] #${id} ${auction.characterName} Lv${auction.level} ${auction.vocation} (${auction.world}) — ${priceStr}`
        );
      } catch (err) {
        consecutiveErrors++;
        console.error(`  Error on ID ${id}: ${(err as Error).message?.substring(0, 80)}`);

        // After 3 consecutive errors, try recovery
        if (consecutiveErrors >= 3) {
          tabReplacementRounds++;

          if (tabReplacementRounds >= 2) {
            // Tab replacement isn't working — full browser restart
            console.log(`  Cloudflare locked out all tabs — restarting browser (30s cooldown)...`);
            await sleep(30000);
            try {
              await closeBrowser(BROWSER);
            } catch {}
            context = await getBrowserContext({ headless, browser: BROWSER });
            // Rebuild all tabs
            const newPages = context.pages();
            for (let t = 0; t < TAB_COUNT; t++) {
              tabs[t] = newPages[t] || (await context.newPage());
            }
            tabReplacementRounds = 0;
            console.log(`  Browser restarted — resuming from ID ${id + step}`);
          } else {
            // First round: just replace the current tab
            console.log(`  ${consecutiveErrors} consecutive errors — cooling down 15s and replacing tab...`);
            await sleep(15000);
            try {
              const newPage = await context.newPage();
              tabs[tabIndex] = newPage;
            } catch {
              try {
                page = await getHealthyPage(BROWSER);
                tabs[tabIndex] = page;
              } catch {
                console.error('  Failed to recover browser — stopping.');
                break;
              }
            }
          }
          consecutiveErrors = 0;
        }

        progress.lastScannedId = id;
        saveProgress(progress);
      }
    }
  } finally {
    saveProgress(progress);
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Scrape by ID — Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  New auctions saved: ${progress.savedCount}
  Skipped (already in DB): ${progress.skippedCount}
  Not found / empty: ${progress.notFoundCount}
  Last scanned ID: ${progress.lastScannedId}
  Progress file: ${progressFile}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
