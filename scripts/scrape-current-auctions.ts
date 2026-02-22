#!/usr/bin/env tsx
/**
 * Current auctions scraper — scrapes live auctions from currentcharactertrades.
 *
 * Browses the list pages, then scrapes each auction's detail page for full stats.
 * New auctions are added; existing auctions get their bids updated.
 * Auctions that no longer appear are marked as inactive.
 *
 * Usage:
 *   pnpm scrape:current                     # Scrape all current auctions
 *   pnpm scrape:current --count 50          # Stop after 50 new auctions
 *   pnpm scrape:current --pages 5           # Only browse first 5 pages
 *   pnpm scrape:current --headless          # Run headless
 *   pnpm scrape:current --no-db             # Skip database saves
 *   pnpm scrape:current --update-only       # Only update bids on existing auctions (skip detail scrape)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, closeBrowser, navigateWithCloudflare, rateLimit, getHealthyPage, sleep } from '../src/lib/scraper/browser';
import type { BrowserName } from '../src/lib/scraper/browser';
import { scrapeSingleAuction, getTotalPages, type ScrapedAuction } from '../src/lib/scraper/auctions';
import { RUBINOT_URLS } from '../src/lib/utils/constants';

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
  const bidPrice = list.currentBid ?? list.minimumBid;

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
      // New fields
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
  console.log(`\nLaunching browser (${BROWSER})...`);
  const context = await getBrowserContext({ headless, browser: BROWSER });
  let page = context.pages()[0] || await context.newPage();

  const baseUrl = `${RUBINOT_URLS.base}${RUBINOT_URLS.currentAuctions}`;
  let newCount = 0;
  let updatedCount = 0;
  let totalFound = 0;
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

    // Process all pages
    const allListAuctions: CurrentListAuction[] = [...firstPageAuctions];

    for (let p = 2; p <= totalPages; p++) {
      if (maxCount && newCount >= maxCount) break;

      await rateLimit();
      const pageUrl = `${RUBINOT_URLS.base}/?subtopic=currentcharactertrades&currentpage=${p}`;
      console.log(`Fetching page ${p}/${totalPages}...`);

      try {
        await navigateWithCloudflare(page, pageUrl);
        await sleep(800 + Math.floor(Math.random() * 1200));
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

    // Track all seen IDs for deactivation
    for (const a of allListAuctions) {
      seenIds.add(a.externalId);
    }

    // Process each auction
    for (const listAuction of allListAuctions) {
      if (maxCount && newCount >= maxCount) break;

      const isNew = !existingIds.has(listAuction.externalId);
      const needsDetail = isNew || rescrape;

      if (needsDetail && !updateOnly) {
        // New auction or rescrape — scrape detail page for full stats
        newCount++;
        await rateLimit();
        const detailUrl = `${RUBINOT_URLS.base}/?currentcharactertrades/${listAuction.externalId}`;
        const target = maxCount ?? '?';
        const label = isNew ? 'NEW' : 'RESCRAPE';
        console.log(`  [${label} ${newCount}/${target}] ${listAuction.characterName} Lv${listAuction.level} (${detailUrl})`);

        let detail: ScrapedAuction | null = null;
        try {
          detail = await scrapeSingleAuction(page, listAuction.externalId);
        } catch (err) {
          console.error(`    Failed detail for ${listAuction.characterName}: ${(err as Error).message?.substring(0, 60)}`);
          try { page = await getHealthyPage(BROWSER); } catch {}
        }

        if (!skipDb) {
          await upsertCurrentAuction(listAuction, detail);
        }
      } else {
        // Existing auction — just update bid
        updatedCount++;
        if (!skipDb) {
          try {
            await updateBidOnly(
              listAuction.externalId,
              listAuction.minimumBid,
              listAuction.currentBid,
              listAuction.hasBeenBidOn,
            );
          } catch {
            // Might not exist yet if updateOnly mode — insert it
            if (updateOnly && !skipDb) {
              await upsertCurrentAuction(listAuction, null);
              newCount++;
            }
          }
        }
      }
    }

    // Mark auctions that are no longer on the site as inactive
    if (!skipDb && !maxPages && !maxCount) {
      const deactivated = await prisma.currentAuction.updateMany({
        where: {
          isActive: true,
          externalId: { notIn: Array.from(seenIds) },
        },
        data: { isActive: false },
      });
      if (deactivated.count > 0) {
        console.log(`\nDeactivated ${deactivated.count} auctions that are no longer on the site`);
      }
    }
  } finally {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Current Auctions Scraper — Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total found on site: ${totalFound}
  New auctions scraped: ${newCount}
  Existing updated: ${updatedCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
