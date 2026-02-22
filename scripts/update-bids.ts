#!/usr/bin/env tsx
/**
 * Bid updater — lightweight script that only updates bid amounts for active auctions.
 *
 * Much faster than the full scraper since it only reads list pages (no detail page visits).
 * Run this frequently (every few hours) to keep bid data current.
 *
 * Usage:
 *   pnpm update:bids                  # Update all active auction bids
 *   pnpm update:bids --pages 5        # Only check first 5 pages
 *   pnpm update:bids --headless       # Run headless
 *   pnpm update:bids --no-db          # Skip database saves
 */
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, closeBrowser, navigateWithCloudflare, rateLimit, getHealthyPage, sleep } from '../src/lib/scraper/browser';
import type { BrowserName } from '../src/lib/scraper/browser';
import { getTotalPages } from '../src/lib/scraper/auctions';
import { RUBINOT_URLS } from '../src/lib/utils/constants';

const BROWSER: BrowserName = 'bid-updater';
const prisma = new PrismaClient();

// ── CLI ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}
const hasFlag = (flag: string) => args.includes(flag);

const maxPages = getArg('--pages') ? parseInt(getArg('--pages')!, 10) : undefined;
const headless = hasFlag('--headless');
const skipDb = hasFlag('--no-db');

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
RubinOT Bid Updater
━━━━━━━━━━━━━━━━━━━━
Updates bid amounts for active current auctions (list pages only, no detail scraping).

Usage:
  pnpm update:bids                  Update all active auction bids
  pnpm update:bids --pages 5        Only check first 5 pages
  pnpm update:bids --headless       Run headless
  pnpm update:bids --no-db          Skip database saves
`);
  process.exit(0);
}

// ── Minimal list page parser (bids only) ───────────────────────────────

interface BidUpdate {
  externalId: string;
  minimumBid: number | null;
  currentBid: number | null;
  hasBeenBidOn: boolean;
  auctionEnd: string | null;
}

function parseNumber(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : null;
}

function parseBidUpdates(html: string): BidUpdate[] {
  const $ = cheerio.load(html);
  const updates: BidUpdate[] = [];

  $('div.Auction').each((_i, el) => {
    const auction = $(el);
    const detailLink = auction.find('.AuctionCharacterName a').attr('href') || '';
    const idMatch = detailLink.match(/currentcharactertrades\/(\d+)/);
    const externalId = idMatch ? idMatch[1] : '';
    if (!externalId) return;

    const labels = auction.find('.ShortAuctionDataLabel');
    const values = auction.find('.ShortAuctionDataValue');
    let minimumBid: number | null = null;
    let currentBid: number | null = null;
    let hasBeenBidOn = false;
    let auctionEnd: string | null = null;

    labels.each((j, lbl) => {
      const lt = $(lbl).text().trim().replace(/\s+/g, ' ');
      const vt = $(values.eq(j)).text().trim();
      if (lt.includes('Auction End')) auctionEnd = vt;
      if (lt.includes('Minimum') && lt.includes('Bid')) {
        minimumBid = parseNumber(vt);
      }
      if (lt.includes('Current') && lt.includes('Bid')) {
        currentBid = parseNumber(vt);
        hasBeenBidOn = true;
      }
    });

    updates.push({ externalId, minimumBid, currentBid, hasBeenBidOn, auctionEnd });
  });

  return updates;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nLaunching browser (${BROWSER})...`);
  const context = await getBrowserContext({ headless, browser: BROWSER });
  let page = context.pages()[0] || await context.newPage();

  const baseUrl = `${RUBINOT_URLS.base}${RUBINOT_URLS.currentAuctions}`;
  let updatedCount = 0;
  let totalFound = 0;
  const seenIds = new Set<string>();

  try {
    // Fetch first page
    console.log(`Fetching page 1: ${baseUrl}`);
    await navigateWithCloudflare(page, baseUrl);
    await sleep(1500 + Math.floor(Math.random() * 1500));

    const firstPageHtml = await page.content();
    const totalPages = maxPages
      ? Math.min(getTotalPages(firstPageHtml), maxPages)
      : getTotalPages(firstPageHtml);

    const allUpdates: BidUpdate[] = [...parseBidUpdates(firstPageHtml)];
    console.log(`Page 1: ${allUpdates.length} auctions, ${totalPages} total pages`);

    // Fetch remaining pages
    for (let p = 2; p <= totalPages; p++) {
      await rateLimit('fast');
      const pageUrl = `${RUBINOT_URLS.base}/?subtopic=currentcharactertrades&currentpage=${p}`;

      try {
        await navigateWithCloudflare(page, pageUrl);
        await sleep(600 + Math.floor(Math.random() * 800));
        const html = await page.content();
        const pageUpdates = parseBidUpdates(html);
        allUpdates.push(...pageUpdates);
        if (p % 10 === 0) console.log(`  Page ${p}/${totalPages}: ${pageUpdates.length} auctions`);
      } catch (err) {
        console.error(`  Failed page ${p}: ${(err as Error).message?.substring(0, 60)}`);
        try { page = await getHealthyPage(BROWSER); } catch {}
      }
    }

    totalFound = allUpdates.length;
    console.log(`\nTotal auctions found: ${totalFound}`);

    // Batch update bids in DB
    if (!skipDb) {
      for (const update of allUpdates) {
        seenIds.add(update.externalId);
        try {
          await prisma.currentAuction.update({
            where: { externalId: update.externalId },
            data: {
              minimumBid: update.minimumBid,
              currentBid: update.currentBid,
              hasBeenBidOn: update.hasBeenBidOn,
              auctionEnd: update.auctionEnd,
            },
          });
          updatedCount++;
        } catch {
          // Auction not in DB yet — skip (will be picked up by full scraper)
        }
      }

      // Mark ended auctions as inactive
      const deactivated = await prisma.currentAuction.updateMany({
        where: {
          isActive: true,
          externalId: { notIn: Array.from(seenIds) },
        },
        data: { isActive: false },
      });
      if (deactivated.count > 0) {
        console.log(`Deactivated ${deactivated.count} ended auctions`);
      }
    }
  } finally {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Bid Updater — Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total found: ${totalFound}
  Bids updated: ${updatedCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Bid updater failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
