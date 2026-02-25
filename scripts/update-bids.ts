#!/usr/bin/env tsx
/**
 * Bid updater — lightweight script that only updates bid amounts for active auctions.
 *
 * Uses the JSON API at /api/bazaar to fetch all auction list pages.
 * Much faster than the full scraper since it only reads list data (no detail page visits).
 * Run this frequently (every few hours) to keep bid data current.
 *
 * Usage:
 *   pnpm update:bids                  # Update all active auction bids
 *   pnpm update:bids --pages 5        # Only check first 5 pages
 *   pnpm update:bids --headless       # Run headless
 *   pnpm update:bids --no-db          # Skip database saves
 */
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, closeBrowser, navigateWithCloudflare, rateLimit, sleep } from '../src/lib/scraper/browser';
import type { BrowserName } from '../src/lib/scraper/browser';
import { fetchBazaarListPage, apiAuctionToListAuction } from '../src/lib/scraper/auctions';
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
RubinOT Bid Updater (API mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Updates bid amounts for active current auctions via /api/bazaar.

Usage:
  pnpm update:bids                  Update all active auction bids
  pnpm update:bids --pages 5        Only check first 5 pages
  pnpm update:bids --headless       Run headless
  pnpm update:bids --no-db          Skip database saves
`);
  process.exit(0);
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nLaunching browser (${BROWSER}) for Cloudflare bypass...`);
  const context = await getBrowserContext({ headless, browser: BROWSER });
  const page = context.pages()[0] || await context.newPage();

  // Navigate to establish Cloudflare session
  await navigateWithCloudflare(page, `${RUBINOT_URLS.base}/bazaar`, 60_000);
  await sleep(2000);

  let updatedCount = 0;
  let totalFound = 0;
  const seenIds = new Set<string>();

  try {
    // Fetch first page via API
    console.log('Fetching bazaar page 1 via API...');
    const firstPageData = await fetchBazaarListPage(page, 1);
    const totalPages = maxPages
      ? Math.min(firstPageData.pagination.totalPages, maxPages)
      : firstPageData.pagination.totalPages;

    const allAuctions = firstPageData.auctions.map(apiAuctionToListAuction);
    console.log(`Page 1: ${allAuctions.length} auctions, ${totalPages} total pages`);

    // Fetch remaining pages
    for (let p = 2; p <= totalPages; p++) {
      await rateLimit('fast');
      try {
        const pageData = await fetchBazaarListPage(page, p);
        const pageAuctions = pageData.auctions.map(apiAuctionToListAuction);
        allAuctions.push(...pageAuctions);
        if (p % 10 === 0) console.log(`  Page ${p}/${totalPages}: ${pageAuctions.length} auctions`);
      } catch (err) {
        console.error(`  Failed page ${p}: ${(err as Error).message?.substring(0, 60)}`);
      }
    }

    totalFound = allAuctions.length;
    console.log(`\nTotal auctions found: ${totalFound}`);

    // Batch update bids in DB
    if (!skipDb) {
      for (const auction of allAuctions) {
        seenIds.add(auction.externalId);
        try {
          await prisma.currentAuction.update({
            where: { externalId: auction.externalId },
            data: {
              minimumBid: auction.minimumBid,
              currentBid: auction.currentBid,
              hasBeenBidOn: auction.hasBeenBidOn,
              auctionEnd: auction.auctionEnd,
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
  Mode: JSON API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Bid updater failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
