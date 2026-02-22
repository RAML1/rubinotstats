#!/usr/bin/env tsx
/**
 * Current auctions scraper — scrapes live auctions from currentcharactertrades.
 *
 * Features:
 *   - Parallel tabs for detail page scraping (configurable concurrency)
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
 *   pnpm scrape:current --tabs 4            # Use 4 parallel tabs for detail scraping (default: 3)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, closeBrowser, navigateWithCloudflare, rateLimit, getHealthyPage, sleep } from '../src/lib/scraper/browser';
import type { BrowserName } from '../src/lib/scraper/browser';
import { scrapeSingleAuction, getTotalPages, type ScrapedAuction } from '../src/lib/scraper/auctions';
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
const PARALLEL_TABS = getArg('--tabs') ? parseInt(getArg('--tabs')!, 10) : 3;

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
RubinOT Current Auctions Scraper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scrapes live auctions from currentcharactertrades.

Usage:
  pnpm scrape:current                     Scrape all current auctions
  pnpm scrape:current --count 50          Stop after 50 new auctions
  pnpm scrape:current --pages 5           Only browse first 5 pages
  pnpm scrape:current --headless          Run headless
  pnpm scrape:current --no-db             Skip database saves
  pnpm scrape:current --update-only       Only update bids (skip detail scrape for new)
  pnpm scrape:current --rescrape          Re-scrape detail pages for ALL auctions (not just new)
  pnpm scrape:current --tabs 4            Use 4 parallel tabs (default: 3)
`);
  process.exit(0);
}

// ── List page parser (adapted for current auctions) ────────────────────

interface CurrentListAuction {
  externalId: string;
  characterName: string;
  level: number | null;
  vocation: string | null;
  gender: string | null;
  world: string | null;
  auctionStart: string | null;
  auctionEnd: string | null;
  minimumBid: number | null;
  currentBid: number | null;
  hasBeenBidOn: boolean;
  // Features from list page
  charmPoints: number | null;
  unusedCharmPoints: number | null;
  bossPoints: number | null;
  exaltedDust: string | null;
  gold: number | null;
  bestiary: number | null;
}

function parseNumber(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : null;
}

function parseCurrentAuctionListPage(html: string): CurrentListAuction[] {
  const $ = cheerio.load(html);
  const auctions: CurrentListAuction[] = [];

  $('div.Auction').each((_i, el) => {
    const auction = $(el);

    const detailLink = auction.find('.AuctionCharacterName a').attr('href') || '';
    const idMatch = detailLink.match(/currentcharactertrades\/(\d+)/);
    const externalId = idMatch ? idMatch[1] : '';
    if (!externalId) return;

    const characterName = auction.find('.AuctionCharacterName a').text().trim();

    const headerText = auction.find('.AuctionHeader').text();
    const levelMatch = headerText.match(/Level:\s*(\d+)/);
    const vocMatch = headerText.match(/Vocation:\s*([^|]+)/);
    const genderMatch = headerText.match(/\|\s*(Male|Female)\s*\|/i);
    const worldMatch = headerText.match(/World:\s*(\S.*?)(?:\s*$|\n)/);

    // Parse date labels
    const labels = auction.find('.ShortAuctionDataLabel');
    const values = auction.find('.ShortAuctionDataValue');
    let auctionStart: string | null = null;
    let auctionEnd: string | null = null;
    let minimumBid: number | null = null;
    let currentBid: number | null = null;
    let hasBeenBidOn = false;

    labels.each((j, lbl) => {
      const lt = $(lbl).text().trim().replace(/\s+/g, ' ');
      const vt = $(values.eq(j)).text().trim();
      if (lt.includes('Auction Start')) auctionStart = vt;
      if (lt.includes('Auction End')) auctionEnd = vt;
      if (lt.includes('Minimum') && lt.includes('Bid')) {
        minimumBid = parseNumber(vt);
      }
      if (lt.includes('Current') && lt.includes('Bid')) {
        currentBid = parseNumber(vt);
        hasBeenBidOn = true;
      }
    });

    // Parse special character features
    let charmPoints: number | null = null;
    let unusedCharmPoints: number | null = null;
    let bossPoints: number | null = null;
    let exaltedDust: string | null = null;
    let gold: number | null = null;
    let bestiary: number | null = null;

    auction.find('.SpecialCharacterFeatures .Entry').each((_j, entry) => {
      const text = $(entry).text().trim();
      const charmMatch = text.match(/Total Charm Points:\s*(\d+)(?:.*Unused Charm Points:\s*(\d+))?/);
      if (charmMatch) {
        charmPoints = parseInt(charmMatch[1], 10);
        if (charmMatch[2]) unusedCharmPoints = parseInt(charmMatch[2], 10);
        return;
      }
      const bossMatch = text.match(/Total Boss Points:\s*(\d+)/);
      if (bossMatch) { bossPoints = parseInt(bossMatch[1], 10); return; }
      const dustMatch = text.match(/Exalted Dust\/Dust Limit:\s*(.+)/);
      if (dustMatch) { exaltedDust = dustMatch[1].trim(); return; }
      const goldMatch = text.match(/^(\d+)\s+Gold/);
      if (goldMatch) { gold = parseInt(goldMatch[1], 10); return; }
      const bestMatch = text.match(/Monsters in Bestiary completed:\s*(\d+)/);
      if (bestMatch) { bestiary = parseInt(bestMatch[1], 10); return; }
    });

    auctions.push({
      externalId,
      characterName,
      level: levelMatch ? parseInt(levelMatch[1], 10) : null,
      vocation: vocMatch ? vocMatch[1].trim() : null,
      gender: genderMatch ? genderMatch[1].trim() : null,
      world: worldMatch ? worldMatch[1].trim() : null,
      auctionStart,
      auctionEnd,
      minimumBid,
      currentBid,
      hasBeenBidOn,
      charmPoints,
      unusedCharmPoints,
      bossPoints,
      exaltedDust,
      gold,
      bestiary,
    });
  });

  return auctions;
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
    url: `${RUBINOT_URLS.base}/?currentcharactertrades/${list.externalId}`,
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
      displayItems: detail.displayItems,
      outfitNames: detail.outfitNames,
      mountNames: detail.mountNames,
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
  // Find auctions that are active in DB but NOT on the site anymore
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
      // Check if already exists in auction history
      const exists = await prisma.auction.findFirst({
        where: { externalId: auction.externalId },
      });

      if (!exists) {
        // Copy to auction history with sold status
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
            // New fields added to auctions table
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
            displayItems: auction.displayItems,
            outfitNames: auction.outfitNames,
            mountNames: auction.mountNames,
          } as any,
        });
        archived++;
      }
    } catch (err) {
      console.error(`  Failed to archive ${auction.characterName}: ${(err as Error).message?.substring(0, 80)}`);
    }
  }

  // Now deactivate them
  await prisma.currentAuction.updateMany({
    where: {
      isActive: true,
      externalId: { notIn: Array.from(seenIds) },
    },
    data: { isActive: false },
  });

  return archived;
}

// ── Parallel detail scraper ──────────────────────────────────────────────

/**
 * Scrape a single auction's detail page using the given tab.
 * Returns the result immediately so it can be saved right away.
 */
async function scrapeDetailWithTab(
  tab: Page,
  listAuction: CurrentListAuction,
  label: string,
): Promise<{ list: CurrentListAuction; detail: ScrapedAuction | null }> {
  try {
    const detail = await scrapeSingleAuction(tab, listAuction.externalId);
    return { list: listAuction, detail };
  } catch (err) {
    console.error(`    Failed detail for ${listAuction.characterName}: ${(err as Error).message?.substring(0, 60)}`);
    return { list: listAuction, detail: null };
  }
}

/**
 * Process a batch of auctions across multiple tabs in parallel.
 * Each auction is saved to DB immediately after its detail is scraped.
 */
async function scrapeDetailsInParallel(
  context: any,
  auctions: CurrentListAuction[],
  existingIds: Set<string>,
  stats: { newCount: number; updatedCount: number; savedCount: number },
): Promise<void> {
  // Separate auctions that need detail scraping vs bid-only updates
  const needDetail: CurrentListAuction[] = [];
  const bidOnly: CurrentListAuction[] = [];

  for (const a of auctions) {
    const isNew = !existingIds.has(a.externalId);
    const needs = isNew || rescrape;

    if (needs && !updateOnly) {
      needDetail.push(a);
    } else {
      bidOnly.push(a);
    }
  }

  // Process bid-only updates immediately (fast, no scraping needed)
  if (!skipDb) {
    for (const a of bidOnly) {
      stats.updatedCount++;
      try {
        await updateBidOnly(a.externalId, a.minimumBid, a.currentBid, a.hasBeenBidOn);
      } catch {
        // Might not exist yet — insert it
        await upsertCurrentAuction(a, null);
        stats.newCount++;
      }
    }
    if (bidOnly.length > 0) {
      console.log(`  Updated bids for ${bidOnly.length} existing auctions`);
    }
  }

  if (needDetail.length === 0) return;

  // Create parallel tabs
  const tabCount = Math.min(PARALLEL_TABS, needDetail.length);
  console.log(`\n  Scraping ${needDetail.length} detail pages using ${tabCount} parallel tabs...`);

  const tabs: Page[] = [];
  for (let i = 0; i < tabCount; i++) {
    try {
      const tab = await context.newPage();
      tabs.push(tab);
    } catch {
      console.error(`  Failed to create tab ${i + 1}`);
    }
  }

  if (tabs.length === 0) {
    console.error('  No tabs available — falling back to single tab');
    // Use the main page as fallback
    const mainPage = context.pages()[0];
    if (mainPage) tabs.push(mainPage);
    else return;
  }

  // Process auctions in parallel batches
  let idx = 0;
  while (idx < needDetail.length) {
    if (maxCount && stats.newCount >= maxCount) break;

    const batch = needDetail.slice(idx, idx + tabs.length);
    idx += batch.length;

    // Small stagger between parallel requests to avoid triggering Cloudflare
    const promises = batch.map(async (auction, i) => {
      if (i > 0) await sleep(300 * i); // stagger by 300ms per tab
      stats.newCount++;
      const isNew = !existingIds.has(auction.externalId);
      const label = isNew ? 'NEW' : 'RESCRAPE';
      const target = maxCount ?? needDetail.length;
      console.log(`  [${label} ${stats.newCount}/${target}] ${auction.characterName} Lv${auction.level}`);
      return scrapeDetailWithTab(tabs[i % tabs.length], auction, label);
    });

    const results = await Promise.allSettled(promises);

    // Save each result immediately
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { list, detail } = result.value;
        if (!skipDb) {
          try {
            await upsertCurrentAuction(list, detail);
            stats.savedCount++;
          } catch (err) {
            console.error(`    DB save failed for ${list.characterName}: ${(err as Error).message?.substring(0, 60)}`);
          }
        }
      }
    }

    // Rate limit between batches
    await rateLimit('fast');
  }

  // Close extra tabs (keep the first one for list page navigation)
  for (let i = 1; i < tabs.length; i++) {
    try { await tabs[i].close(); } catch {}
  }
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

  // Launch browser
  console.log(`\nLaunching browser (${BROWSER}) with ${PARALLEL_TABS} parallel tabs...`);
  const context = await getBrowserContext({ headless, browser: BROWSER });
  let page = context.pages()[0] || await context.newPage();

  const baseUrl = `${RUBINOT_URLS.base}${RUBINOT_URLS.currentAuctions}`;
  const stats = { newCount: 0, updatedCount: 0, savedCount: 0 };
  let totalFound = 0;
  let archivedCount = 0;
  const seenIds = new Set<string>();

  try {
    // Fetch first page
    console.log(`\nFetching page 1: ${baseUrl}`);
    await navigateWithCloudflare(page, baseUrl);
    await sleep(1500 + Math.floor(Math.random() * 1500));

    const firstPageHtml = await page.content();
    const totalPages = maxPages
      ? Math.min(getTotalPages(firstPageHtml), maxPages)
      : getTotalPages(firstPageHtml);

    const firstPageAuctions = parseCurrentAuctionListPage(firstPageHtml);
    console.log(`Page 1: ${firstPageAuctions.length} auctions, ${totalPages} total pages`);

    // Collect all list page data
    const allListAuctions: CurrentListAuction[] = [...firstPageAuctions];

    for (let p = 2; p <= totalPages; p++) {
      if (maxCount && stats.newCount >= maxCount) break;

      await rateLimit('fast');
      const pageUrl = `${RUBINOT_URLS.base}/?subtopic=currentcharactertrades&currentpage=${p}`;
      console.log(`Fetching page ${p}/${totalPages}...`);

      try {
        await navigateWithCloudflare(page, pageUrl);
        await sleep(600 + Math.floor(Math.random() * 800));
        const html = await page.content();
        const pageAuctions = parseCurrentAuctionListPage(html);
        console.log(`  Page ${p}: ${pageAuctions.length} auctions`);
        allListAuctions.push(...pageAuctions);
      } catch (err) {
        console.error(`  Failed page ${p}: ${(err as Error).message?.substring(0, 80)}`);
        try {
          page = await getHealthyPage(BROWSER);
        } catch {}
      }
    }

    totalFound = allListAuctions.length;
    console.log(`\nTotal auctions found on site: ${totalFound}`);

    // Track all seen IDs for deactivation/archival
    for (const a of allListAuctions) {
      seenIds.add(a.externalId);
    }

    // Scrape details in parallel and save as we go
    await scrapeDetailsInParallel(context, allListAuctions, existingIds, stats);

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
  Parallel tabs used: ${PARALLEL_TABS}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
