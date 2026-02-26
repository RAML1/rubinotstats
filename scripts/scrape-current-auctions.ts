#!/usr/bin/env tsx
/**
 * Current auctions scraper — uses the JSON API at /api/bazaar.
 *
 * Features:
 *   - Fetches auction list via API (no HTML parsing needed)
 *   - Fetches detail pages via /api/bazaar/{id} for full skill data
 *   - Save-as-you-go: each auction is saved immediately after scraping
 *   - Archive: ended auctions are copied to auction history before deactivation
 *
 * Usage:
 *   pnpm scrape:current                     # Scrape all current auctions
 *   pnpm scrape:current --count 50          # Stop after 50 new auctions
 *   pnpm scrape:current --pages 5           # Only browse first 5 pages
 *   pnpm scrape:current --headless          # Run headless
 *   pnpm scrape:current --no-db             # Skip database saves
 *   pnpm scrape:current --update-only       # Only update bids on existing auctions (skip detail scrape)
 *   pnpm scrape:current --rescrape          # Re-scrape detail pages for ALL auctions (not just new)
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, closeBrowser, navigateWithCloudflare, rateLimit, sleep } from '../src/lib/scraper/browser';
import type { BrowserName } from '../src/lib/scraper/browser';
import {
  fetchBazaarListPage,
  fetchBazaarDetail,
  apiAuctionToListAuction,
  apiDetailToScrapedAuction,
  type CurrentListAuction,
  type ScrapedAuction,
} from '../src/lib/scraper/auctions';
import { RUBINOT_URLS } from '../src/lib/utils/constants';
import type { Page } from 'playwright';

const BROWSER: BrowserName = 'current-auctions';
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
const updateOnly = hasFlag('--update-only');
const rescrape = hasFlag('--rescrape');

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
RubinOT Current Auctions Scraper (API mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scrapes live auctions via /api/bazaar JSON API.

Usage:
  pnpm scrape:current                     Scrape all current auctions
  pnpm scrape:current --count 50          Stop after 50 new auctions
  pnpm scrape:current --pages 5           Only browse first 5 pages
  pnpm scrape:current --headless          Run headless
  pnpm scrape:current --no-db             Skip database saves
  pnpm scrape:current --update-only       Only update bids (skip detail scrape for new)
  pnpm scrape:current --rescrape          Re-scrape detail pages for ALL auctions (not just new)
`);
  process.exit(0);
}

// ── Database helpers ───────────────────────────────────────────────────

async function upsertCurrentAuction(list: CurrentListAuction, detail: ScrapedAuction | null): Promise<void> {
  const data: Record<string, unknown> = {
    characterName: list.characterName,
    level: list.level,
    vocation: list.vocation,
    gender: list.gender,
    world: list.world,
    auctionStart: list.auctionStart,
    auctionEnd: list.auctionEnd,
    minimumBid: list.minimumBid,
    currentBid: list.currentBid,
    hasBeenBidOn: list.hasBeenBidOn,
    charmPoints: list.charmPoints,
    unusedCharmPoints: list.unusedCharmPoints,
    bossPoints: list.bossPoints,
    exaltedDust: list.exaltedDust,
    gold: list.gold,
    bestiary: list.bestiary,
    isActive: true,
    url: `${RUBINOT_URLS.base}/bazaar/${list.externalId}`,
  };

  // Merge detail page data if available
  if (detail) {
    Object.assign(data, {
      magicLevel: detail.magicLevel,
      fist: detail.fist,
      club: detail.club,
      sword: detail.sword,
      axe: detail.axe,
      distance: detail.distance,
      shielding: detail.shielding,
      fishing: detail.fishing,
      hitPoints: detail.hitPoints,
      mana: detail.mana,
      capacity: detail.capacity,
      speed: detail.speed,
      experience: detail.experience,
      creationDate: detail.creationDate,
      achievementPoints: detail.achievementPoints,
      mountsCount: detail.mountsCount,
      outfitsCount: detail.outfitsCount,
      titlesCount: detail.titlesCount,
      linkedTasks: detail.linkedTasks,
      dailyRewardStreak: detail.dailyRewardStreak,
      charmExpansion: detail.charmExpansion,
      spentCharmPoints: detail.spentCharmPoints,
      preySlots: detail.preySlots,
      preyWildcards: detail.preyWildcards,
      huntingTaskPoints: detail.huntingTaskPoints,
      hirelings: detail.hirelings,
      hirelingJobs: detail.hirelingJobs,
      hasLootPouch: detail.hasLootPouch,
      storeItemsCount: detail.storeItemsCount,
      blessingsCount: detail.blessingsCount,
      primalOrdealAvailable: detail.primalOrdealAvailable,
      soulWarAvailable: detail.soulWarAvailable,
      sanguineBloodAvailable: detail.sanguineBloodAvailable,
      magicLevelPct: detail.magicLevelPct,
      fistPct: detail.fistPct,
      clubPct: detail.clubPct,
      swordPct: detail.swordPct,
      axePct: detail.axePct,
      distancePct: detail.distancePct,
      shieldingPct: detail.shieldingPct,
      fishingPct: detail.fishingPct,
      outfitImageUrl: detail.outfitImageUrl,
      gems: detail.gems,
      weeklyTaskExpansion: detail.weeklyTaskExpansion,
      battlePassDeluxe: detail.battlePassDeluxe,
      displayItems: detail.displayItems,
      outfitNames: detail.outfitNames,
      mountNames: detail.mountNames,
      weaponProficiency: detail.weaponProficiency,
    });
  }

  await prisma.currentAuction.upsert({
    where: { externalId: list.externalId },
    update: data,
    create: { externalId: list.externalId, characterName: list.characterName, ...data } as any,
  });
}

async function updateBidOnly(externalId: string, minimumBid: number | null, currentBid: number | null, hasBeenBidOn: boolean): Promise<void> {
  await prisma.currentAuction.update({
    where: { externalId },
    data: { minimumBid, currentBid, hasBeenBidOn },
  });
}

/**
 * Archive ended auctions: copy their data from current_auctions to auctions (history),
 * then mark them as inactive.
 */
async function archiveEndedAuctions(seenIds: Set<string>): Promise<number> {
  const ended = await prisma.currentAuction.findMany({
    where: {
      isActive: true,
      externalId: { notIn: Array.from(seenIds) },
    },
  });

  if (ended.length === 0) return 0;

  let archived = 0;
  for (const auction of ended) {
    try {
      const exists = await prisma.auction.findFirst({
        where: { externalId: auction.externalId },
      });

      if (!exists) {
        await prisma.auction.create({
          data: {
            externalId: auction.externalId,
            characterName: auction.characterName,
            level: auction.level,
            vocation: auction.vocation,
            gender: auction.gender,
            world: auction.world,
            auctionStart: auction.auctionStart,
            auctionEnd: auction.auctionEnd,
            auctionStatus: auction.hasBeenBidOn ? 'sold' : 'expired',
            soldPrice: auction.currentBid ?? auction.minimumBid,
            coinsPerLevel: auction.level && auction.level > 0
              ? Math.round(((auction.currentBid ?? auction.minimumBid ?? 0) / auction.level) * 100) / 100
              : null,
            magicLevel: auction.magicLevel,
            fist: auction.fist,
            club: auction.club,
            sword: auction.sword,
            axe: auction.axe,
            distance: auction.distance,
            shielding: auction.shielding,
            fishing: auction.fishing,
            hitPoints: auction.hitPoints,
            mana: auction.mana,
            capacity: auction.capacity,
            speed: auction.speed,
            experience: auction.experience,
            creationDate: auction.creationDate,
            achievementPoints: auction.achievementPoints,
            mountsCount: auction.mountsCount,
            outfitsCount: auction.outfitsCount,
            titlesCount: auction.titlesCount,
            linkedTasks: auction.linkedTasks,
            dailyRewardStreak: auction.dailyRewardStreak,
            charmExpansion: auction.charmExpansion,
            charmPoints: auction.charmPoints,
            unusedCharmPoints: auction.unusedCharmPoints,
            spentCharmPoints: auction.spentCharmPoints,
            preySlots: auction.preySlots,
            preyWildcards: auction.preyWildcards,
            huntingTaskPoints: auction.huntingTaskPoints,
            hirelings: auction.hirelings,
            hirelingJobs: auction.hirelingJobs,
            hasLootPouch: auction.hasLootPouch,
            storeItemsCount: auction.storeItemsCount,
            bossPoints: auction.bossPoints,
            blessingsCount: auction.blessingsCount,
            exaltedDust: auction.exaltedDust,
            gold: auction.gold,
            bestiary: auction.bestiary,
            url: auction.url,
            primalOrdealAvailable: auction.primalOrdealAvailable,
            soulWarAvailable: auction.soulWarAvailable,
            sanguineBloodAvailable: auction.sanguineBloodAvailable,
            minimumBid: auction.minimumBid,
            currentBid: auction.currentBid,
            hasBeenBidOn: auction.hasBeenBidOn,
            magicLevelPct: auction.magicLevelPct,
            fistPct: auction.fistPct,
            clubPct: auction.clubPct,
            swordPct: auction.swordPct,
            axePct: auction.axePct,
            distancePct: auction.distancePct,
            shieldingPct: auction.shieldingPct,
            fishingPct: auction.fishingPct,
            outfitImageUrl: auction.outfitImageUrl,
            gems: auction.gems,
            weeklyTaskExpansion: auction.weeklyTaskExpansion,
            battlePassDeluxe: auction.battlePassDeluxe,
            displayItems: auction.displayItems,
            outfitNames: auction.outfitNames,
            mountNames: auction.mountNames,
            weaponProficiency: auction.weaponProficiency,
          } as any,
        });
        archived++;
      }
    } catch (err) {
      console.error(`  Failed to archive ${auction.characterName}: ${(err as Error).message?.substring(0, 80)}`);
    }
  }

  await prisma.currentAuction.updateMany({
    where: {
      isActive: true,
      externalId: { notIn: Array.from(seenIds) },
    },
    data: { isActive: false },
  });

  return archived;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Load existing auction IDs
  const existing = await prisma.currentAuction.findMany({
    select: { externalId: true },
    where: { isActive: true },
  });
  const existingIds = new Set(existing.map(e => e.externalId));
  console.log(`Found ${existingIds.size} existing active current auctions in DB`);

  // Launch browser (still needed for Cloudflare bypass)
  console.log(`\nLaunching browser (${BROWSER}) for Cloudflare bypass...`);
  const context = await getBrowserContext({ headless, browser: BROWSER });
  let page = context.pages()[0] || await context.newPage();

  // Navigate to establish Cloudflare session
  console.log('Navigating to bazaar for Cloudflare bypass...');
  await navigateWithCloudflare(page, `${RUBINOT_URLS.base}/bazaar`, 60_000);
  await sleep(2000);

  const stats = { newCount: 0, updatedCount: 0, savedCount: 0 };
  let totalFound = 0;
  let archivedCount = 0;
  const seenIds = new Set<string>();

  try {
    // Fetch first page via API
    console.log('\nFetching bazaar page 1 via API...');
    const firstPageData = await fetchBazaarListPage(page, 1);
    const totalPages = maxPages
      ? Math.min(firstPageData.pagination.totalPages, maxPages)
      : firstPageData.pagination.totalPages;

    const firstPageAuctions = firstPageData.auctions.map(apiAuctionToListAuction);
    console.log(`Page 1: ${firstPageAuctions.length} auctions, ${totalPages} total pages, ${firstPageData.pagination.total} total`);

    const allListAuctions: CurrentListAuction[] = [...firstPageAuctions];

    // Fetch remaining list pages
    for (let p = 2; p <= totalPages; p++) {
      if (maxCount && stats.newCount >= maxCount) break;

      await rateLimit('fast');
      console.log(`Fetching page ${p}/${totalPages}...`);

      try {
        const pageData = await fetchBazaarListPage(page, p);
        const pageAuctions = pageData.auctions.map(apiAuctionToListAuction);
        console.log(`  Page ${p}: ${pageAuctions.length} auctions`);
        allListAuctions.push(...pageAuctions);
      } catch (err) {
        console.error(`  Failed page ${p}: ${(err as Error).message?.substring(0, 80)}`);
      }
    }

    totalFound = allListAuctions.length;
    console.log(`\nTotal auctions found on site: ${totalFound}`);

    // Track all seen IDs for deactivation/archival
    for (const a of allListAuctions) {
      seenIds.add(a.externalId);
    }

    // Separate auctions that need detail scraping vs bid-only updates
    const needDetail: CurrentListAuction[] = [];
    const bidOnly: CurrentListAuction[] = [];

    for (const a of allListAuctions) {
      const isNew = !existingIds.has(a.externalId);
      const needs = isNew || rescrape;

      if (needs && !updateOnly) {
        needDetail.push(a);
      } else {
        bidOnly.push(a);
      }
    }

    // Process bid-only updates immediately
    if (!skipDb) {
      for (const a of bidOnly) {
        stats.updatedCount++;
        try {
          await updateBidOnly(a.externalId, a.minimumBid, a.currentBid, a.hasBeenBidOn);
        } catch {
          await upsertCurrentAuction(a, null);
          stats.newCount++;
        }
      }
      if (bidOnly.length > 0) {
        console.log(`  Updated bids for ${bidOnly.length} existing auctions`);
      }
    }

    // Scrape detail pages for new auctions
    if (needDetail.length > 0) {
      console.log(`\n  Scraping ${needDetail.length} detail pages via API...`);

      for (const listAuction of needDetail) {
        if (maxCount && stats.newCount >= maxCount) break;
        stats.newCount++;

        const isNew = !existingIds.has(listAuction.externalId);
        const label = isNew ? 'NEW' : 'RESCRAPE';
        const target = maxCount ?? needDetail.length;
        console.log(`  [${label} ${stats.newCount}/${target}] ${listAuction.characterName} Lv${listAuction.level}`);

        try {
          await rateLimit('fast');
          const detail = await fetchBazaarDetail(page, listAuction.externalId);
          const auction = apiDetailToScrapedAuction(detail, listAuction);

          if (!skipDb) {
            await upsertCurrentAuction(listAuction, auction);
            stats.savedCount++;
          }
        } catch (err) {
          console.error(`    Failed detail for ${listAuction.characterName}:`, (err as Error).message);
          // Save with list data only
          if (!skipDb) {
            try {
              await upsertCurrentAuction(listAuction, null);
              stats.savedCount++;
            } catch {}
          }
        }
      }
    }

    // Archive ended auctions to history, then deactivate
    if (!skipDb && !maxPages && !maxCount) {
      console.log('\nArchiving ended auctions to history...');
      archivedCount = await archiveEndedAuctions(seenIds);
      if (archivedCount > 0) {
        console.log(`  Archived ${archivedCount} ended auctions to history`);
      }
    }
  } finally {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Current Auctions Scraper — Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total found on site: ${totalFound}
  Detail pages scraped: ${stats.newCount}
  Successfully saved: ${stats.savedCount}
  Bids updated: ${stats.updatedCount}
  Archived to history: ${archivedCount}
  Mode: JSON API (no HTML parsing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
