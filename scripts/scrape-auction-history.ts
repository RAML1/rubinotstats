#!/usr/bin/env tsx
/**
 * CLI script for scraping RubinOT auction history from list pages.
 *
 * Browses pastcharactertrades pages to discover auctions, skips ones
 * already in DB, then scrapes detail pages for new auctions.
 *
 * Usage:
 *   pnpm scrape:history                    # Scrape all new auctions from list
 *   pnpm scrape:history --count 50         # Stop after 50 new auctions
 *   pnpm scrape:history --pages 10         # Only browse first 10 list pages
 *   pnpm scrape:history --no-db            # Skip saving to database
 *   pnpm scrape:history --headless         # Run headless (may fail on CF)
 */
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, closeBrowser, type BrowserName } from '../src/lib/scraper/browser';
import { scrapeAuctionHistory, type ScrapedAuction } from '../src/lib/scraper/auctions';

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

const maxPages = getArg('--pages') ? parseInt(getArg('--pages')!, 10) : undefined;
const maxCount = getArg('--count') ? parseInt(getArg('--count')!, 10) : undefined;
const headless = hasFlag('--headless');
const skipDb = hasFlag('--no-db');

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
RubinOT Auction History Scraper (list-based)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Browses past auction list pages to discover new auctions,
then scrapes detail pages for full data.

Usage:
  pnpm scrape:history                    Scrape all new auctions
  pnpm scrape:history --count 50         Stop after 50 new auctions
  pnpm scrape:history --pages 10         Only browse first 10 list pages
  pnpm scrape:history --no-db            Skip saving to database
  pnpm scrape:history --headless         Run headless (may fail on Cloudflare)
`);
  process.exit(0);
}

// ── Database ────────────────────────────────────────────────────────────

let dbSavedCount = 0;

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
  dbSavedCount++;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  // Load existing auction IDs from DB for skip detection
  const existing = await prisma.auction.findMany({ select: { externalId: true } });
  const existingIds = new Set(existing.map((e) => e.externalId));

  console.log(`
RubinOT Auction History Scraper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Existing in DB:  ${existingIds.size}
  Max list pages:  ${maxPages ?? 'all'}
  Max new auctions: ${maxCount ?? 'all'}
  Save to DB:      ${skipDb ? 'no' : 'yes'}
`);

  console.log(`Launching browser (${BROWSER})...`);
  const context = await getBrowserContext({ headless, browser: BROWSER });
  const page = context.pages()[0] || (await context.newPage());

  const startTime = Date.now();

  try {
    const onAuction = skipDb ? undefined : async (a: ScrapedAuction) => {
      await upsertAuction(a);
    };

    const auctions = await scrapeAuctionHistory(page, {
      maxPages,
      maxAuctions: maxCount,
      skipExternalIds: existingIds,
      onAuction,
      browserName: BROWSER,
    });

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Auction History — Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  New auctions scraped: ${auctions.length}
  Saved to DB:          ${skipDb ? 'skipped' : dbSavedCount}
  Total time:           ${elapsed} minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (auctions.length > 0) {
      const byWorld: Record<string, number> = {};
      const byVocation: Record<string, number> = {};
      for (const a of auctions) {
        if (a.world) byWorld[a.world] = (byWorld[a.world] || 0) + 1;
        if (a.vocation) byVocation[a.vocation] = (byVocation[a.vocation] || 0) + 1;
      }
      console.log(`
  By World:
${Object.entries(byWorld).sort((a, b) => b[1] - a[1]).map(([w, c]) => `    ${w}: ${c}`).join('\n')}

  By Vocation:
${Object.entries(byVocation).sort((a, b) => b[1] - a[1]).map(([v, c]) => `    ${v}: ${c}`).join('\n')}`);
    }
  } finally {
    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Auction history scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
